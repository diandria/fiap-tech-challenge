import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * End-to-end validation load, so no dashboard is empty during the recording.
 *
 * Each scenario feeds a different panel:
 *
 *   serviceOrderCycle    -> service order volume, time per status and the saga panel
 *   customerAuth         -> latency of the route that crosses the function
 *   burst                -> HPA adding replicas (the demonstration panel)
 *   deliberateErrors     -> error panels, which would sit at zero without this
 *
 * Usage:
 *   BASE_URL=$(cd ~/dev/fiap-tech-challenge-infra-k8s && terraform output -raw api_gateway_url) \
 *   ADMIN_PASSWORD=$(aws ssm get-parameter --name /car-repair-shop/app/admin-password \
 *     --with-decryption --query 'Parameter.Value' --output text) \
 *   k6 run scripts/load-test.js
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@master.com';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || '';

// The budget confirmation code is the tax id's first four digits:
// `verifyCustomerCode` compares against `customer.taxId.slice(0, 4)`.
const TAX_ID = __ENV.CPF || '52998224725';
const BUDGET_CODE = TAX_ID.slice(0, 4);
const LOAD_SERVICE = 'Load Test Service';

const JSON_HEADERS = { 'content-type': 'application/json' };

export const options = {
  scenarios: {
    // Low, steady volume: each iteration walks an order through the whole saga.
    serviceOrderCycle: {
      executor: 'constant-arrival-rate',
      rate: 6, timeUnit: '1m', duration: '5m',
      preAllocatedVUs: 4, maxVUs: 10,
      exec: 'serviceOrderCycle',
    },

    // Crosses gateway -> authentication function -> lookup in the application.
    customerAuth: {
      executor: 'constant-arrival-rate',
      rate: 10, timeUnit: '1m', duration: '5m',
      preAllocatedVUs: 3, maxVUs: 8,
      exec: 'customerAuth',
      startTime: '15s',
    },

    // Arrival rate, not VU count: the gateway throttles at 100 req/s, so a
    // VU-driven test measures the throttle rather than the application. At 60
    // req/s the HPA still went from 2 to the cap of 10 (measured 2026-08-31).
    burst: {
      executor: 'ramping-arrival-rate',
      startRate: 0, timeUnit: '1s',
      preAllocatedVUs: 20, maxVUs: 60,
      stages: [
        { duration: '30s', target: 60 },
        { duration: '3m', target: 60 },
        { duration: '30s', target: 0 },
      ],
      exec: 'burst',
      startTime: '30s',
    },

    // Without this the error panels stay at zero.
    deliberateErrors: {
      executor: 'constant-arrival-rate',
      rate: 12, timeUnit: '1m', duration: '5m',
      preAllocatedVUs: 2, maxVUs: 5,
      exec: 'deliberateErrors',
      startTime: '20s',
    },
  },

  // No latency threshold: the burst is built to saturate. Technical errors are
  // what must not happen.
  thresholds: {
    'http_req_failed{scenario:serviceOrderCycle}': ['rate<0.10'],
    'http_req_failed{scenario:customerAuth}': ['rate<0.10'],

    // Failing here means the load went past the gateway limit.
    'http_req_failed{scenario:burst}': ['rate<0.05'],
  },
};

function authenticate(url, body) {
  const r = http.post(url, JSON.stringify(body), { headers: JSON_HEADERS });
  if (r.status !== 200) return null;
  try { return r.json('token'); } catch (e) { return null; }
}

export function setup() {
  if (!ADMIN_PASSWORD) {
    throw new Error('ADMIN_PASSWORD is not set. Read it from SSM: ' +
      'aws ssm get-parameter --name /car-repair-shop/app/admin-password --with-decryption');
  }

  const token = authenticate(`${BASE_URL}/auth/login`,
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (!token) throw new Error('admin login failed; is the environment up?');

  const auth = { headers: { ...JSON_HEADERS, authorization: `Bearer ${token}` } };

  // Created once and reused: per-iteration creation would measure the INSERT.
  let customerId = __ENV.CUSTOMER_ID;
  if (!customerId) {
    const r = http.post(`${BASE_URL}/customers`, JSON.stringify({
      name: 'Load Test Customer', taxId: TAX_ID, taxType: 'CPF',
      email: 'load@test.com', phone: '11999999999',
    }), auth);
    // 409 means it already exists from an earlier run: look it up by tax id.
    // The list route has no tax id filter, and its first entry would be
    // another customer, whose orders this customer's token cannot read.
    if (r.status === 201) {
      customerId = r.json('id');
    } else {
      const lookup = http.get(`${BASE_URL}/customers/tax/${TAX_ID}`, auth);
      customerId = lookup.status === 200 ? lookup.json('id') : null;
    }
  }
  if (!customerId) throw new Error('could not obtain the load test customer');

  let vehicleId = __ENV.VEHICLE_ID;
  if (!vehicleId) {
    const r = http.post(`${BASE_URL}/vehicles`, JSON.stringify({
      customerId, plate: `CRG${Math.floor(Math.random() * 9000 + 1000)}`,
      brand: 'Fiat', model: 'Uno', year: 2020,
    }), auth);
    vehicleId = r.status === 201 ? r.json('id') : null;
  }
  if (!vehicleId) throw new Error('could not obtain the load test vehicle');

  // The service the mechanic adds during the diagnosis. Without one the budget
  // is zero, and a payment provider refuses to charge zero: the charge fails
  // until the saga gives up and cancels the order.
  let serviceId = __ENV.SERVICE_ID;
  if (!serviceId) {
    const catalogue = http.get(`${BASE_URL}/services`, auth);
    const existing = catalogue.status === 200 ? catalogue.json().find((s) => s.name === LOAD_SERVICE) : null;
    if (existing) {
      serviceId = existing.id;
    } else {
      const r = http.post(`${BASE_URL}/services`,
        JSON.stringify({ name: LOAD_SERVICE, price: 120, estimatedMinutes: 30 }), auth);
      serviceId = r.status === 201 ? r.json('id') : null;
    }
  }
  if (!serviceId) throw new Error('could not obtain the load test service');

  // An order of the load test customer: the customer routes only answer for
  // the customer's own orders, so the customerAuth scenario reads this one.
  const order = http.post(`${BASE_URL}/service-orders`, JSON.stringify({ customerId, vehicleId }), auth);
  const orderId = order.status === 201 ? order.json('id') : null;
  if (!orderId) throw new Error('could not open the load test customer order');

  return { token, customerId, vehicleId, serviceId, orderId };
}

// A 404 while waiting means "not there yet", not a failure: without this the
// polling would push the scenario over its error threshold.
const WAITING = { responseCallback: http.expectedStatuses(200, 404) };

/** Reads until the answer satisfies `until`, half a second apart. */
function waitFor(read, until, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    const r = read();
    if (r.status === 200 && until(r)) return r;
    sleep(0.5);
  }
  return null;
}

/**
 * Walks an order through the saga as the services would: the OS opens it, the
 * mechanic diagnoses it at Execution, Billing generates the budget and the
 * customer approves it at Billing, pays it at the payment service's checkout,
 * the mechanic repairs it and the OS delivers it. Every status gets a point on
 * the dashboards, and the order is a real one: it has a service, so the charge
 * is never zero.
 */
export function serviceOrderCycle(data) {
  const params = { ...WAITING, headers: { ...JSON_HEADERS, authorization: `Bearer ${data.token}` } };
  const auth = { headers: params.headers };

  const created = http.post(`${BASE_URL}/service-orders`, JSON.stringify({
    customerId: data.customerId, vehicleId: data.vehicleId,
  }), auth);
  if (!check(created, { 'service order created': (r) => r.status === 201 })) return;
  const osId = created.json('id');

  const queued = waitFor(() => http.get(`${BASE_URL}/executions/${osId}`, params),
    (r) => r.json('stage') === 'DIAGNOSIS' && r.json('status') === 'QUEUED');
  if (!check(queued, { 'order reached the mechanic queue': (r) => r !== null })) return;

  check(http.post(`${BASE_URL}/executions/${osId}/start`, null, auth), { 'diagnosis started': (r) => r.status === 200 });

  // The OS takes services only in DIAGNOSIS, and it gets there when the saga's
  // DiagnosisStarted reply arrives, a moment after the start at Execution.
  const diagnosing = waitFor(() => http.get(`${BASE_URL}/service-orders/${osId}`, params),
    (r) => r.json('status') === 'DIAGNOSIS');
  if (!check(diagnosing, { 'order in diagnosis at the OS': (r) => r !== null })) return;
  check(http.post(`${BASE_URL}/service-orders/${osId}/services`, JSON.stringify({ serviceId: data.serviceId }), auth),
    { 'service added to the order': (r) => r.status === 200 || r.status === 201 });
  check(http.post(`${BASE_URL}/executions/${osId}/finish`, null, auth), { 'diagnosis finished': (r) => r.status === 200 });

  const budget = waitFor(() => http.get(`${BASE_URL}/service-orders/${osId}/budget`, params),
    (r) => r.json('status') === 'PENDING_APPROVAL');
  if (!check(budget, { 'billing produced the budget': (r) => r !== null })) return;

  // Approval belongs to the customer: separate token and the confirmation code.
  const customerToken = authenticate(`${BASE_URL}/auth/cpf`, { cpf: TAX_ID });
  if (!customerToken) return;
  const approved = http.patch(`${BASE_URL}/service-orders/${osId}/budget`,
    JSON.stringify({ status: 'APPROVED', code: BUDGET_CODE }),
    { headers: { ...JSON_HEADERS, authorization: `Bearer ${customerToken}` } });
  if (!check(approved, { 'budget approved': (x) => x.status === 200 })) return;

  // The customer pays at the payment service's checkout, through the gateway.
  const charge = waitFor(() => http.get(`${BASE_URL}/service-orders/${osId}/budget`, params),
    (r) => r.json('payment.status') === 'PENDING');
  if (!check(charge, { 'billing created the charge': (r) => r !== null })) return;
  const paid = http.post(`${charge.json('payment.checkoutUrl')}/pay`, JSON.stringify({ status: 'approved' }),
    { headers: JSON_HEADERS });
  if (!check(paid, { 'customer paid at the checkout': (r) => r.status === 201 })) return;

  // Once the saga confirms the payment, the repair goes to the mechanic's queue.
  const repair = waitFor(() => http.get(`${BASE_URL}/executions/${osId}`, params),
    (r) => r.json('stage') === 'REPAIR' && r.json('status') === 'QUEUED');
  if (!check(repair, { 'order reached the repair queue': (r) => r !== null })) return;
  check(http.post(`${BASE_URL}/executions/${osId}/start`, null, auth), { 'repair started': (r) => r.status === 200 });
  check(http.post(`${BASE_URL}/executions/${osId}/finish`, null, auth), { 'repair finished': (r) => r.status === 200 });

  const finished = waitFor(() => http.get(`${BASE_URL}/service-orders/${osId}`, params),
    (r) => r.json('status') === 'FINISHED');
  if (!check(finished, { 'order finished': (r) => r !== null })) return;
  check(http.patch(`${BASE_URL}/service-orders/${osId}`, JSON.stringify({ status: 'DELIVERED' }), auth),
    { 'order delivered': (r) => r.status === 200 });
}

export function customerAuth(data) {
  const token = authenticate(`${BASE_URL}/auth/cpf`, { cpf: TAX_ID });
  check(token, { 'customer token issued': (t) => !!t });
  if (!token) return;

  // The order list is staff only; a customer reads the status of their own order.
  const r = http.get(`${BASE_URL}/service-orders/${data.orderId}/status`,
    { headers: { authorization: `Bearer ${token}` } });
  check(r, { 'customer reads the status of their own order': (x) => x.status === 200 });
}

// One request per iteration: at 60/s, two calls would exceed the gateway limit.
export function burst(data) {
  const auth = { headers: { authorization: `Bearer ${data.token}` } };
  const r = http.get(`${BASE_URL}/service-orders`, auth);
  check(r, {
    'list returns 200': (x) => x.status === 200,
    'no gateway throttling': (x) => x.status !== 429,
  });
}

export function deliberateErrors(data) {
  const auth = { headers: { ...JSON_HEADERS, authorization: `Bearer ${data.token}` } };

  // 404: resource that does not exist.
  check(http.get(`${BASE_URL}/service-orders/00000000-0000-0000-0000-000000000000`, auth),
    { 'returns 404': (r) => r.status === 404 });

  // 400: invalid transition. A business error, so it does not touch the 5xx rate.
  const created = http.post(`${BASE_URL}/service-orders`, JSON.stringify({
    customerId: data.customerId, vehicleId: data.vehicleId,
  }), auth);
  if (created.status === 201) {
    const r = http.patch(`${BASE_URL}/service-orders/${created.json('id')}`,
      JSON.stringify({ status: 'DELIVERED' }), auth);
    check(r, { 'invalid transition returns 400': (x) => x.status === 400 });
  }

  // 401: no token.
  check(http.get(`${BASE_URL}/service-orders`), { 'no token returns 401': (r) => r.status === 401 });
}
