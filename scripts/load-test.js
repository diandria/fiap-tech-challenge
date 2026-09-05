import http from 'k6/http';
import { check } from 'k6';

/**
 * End-to-end validation load, so no M9 dashboard is empty during the recording.
 *
 * Each scenario feeds a different panel:
 *
 *   serviceOrderCycle    -> service order volume and time per status
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

const JSON_HEADERS = { 'content-type': 'application/json' };

export const options = {
  scenarios: {
    // Low, steady volume: each iteration walks the six statuses.
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
    // 409 means it already exists from an earlier run: look the id up.
    if (r.status === 201) {
      customerId = r.json('id');
    } else {
      const lookup = http.get(`${BASE_URL}/customers?taxId=${TAX_ID}`, auth);
      const body = lookup.json();
      customerId = Array.isArray(body) && body.length ? body[0].id
        : (body && body.data && body.data.length ? body.data[0].id : null);
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

  return { token, customerId, vehicleId };
}

export function serviceOrderCycle(data) {
  const auth = { headers: { ...JSON_HEADERS, authorization: `Bearer ${data.token}` } };

  const created = http.post(`${BASE_URL}/service-orders`, JSON.stringify({
    customerId: data.customerId, vehicleId: data.vehicleId,
  }), auth);
  if (!check(created, { 'service order created': (r) => r.status === 201 })) return;

  const osId = created.json('id');
  const moveTo = (status) => http.patch(`${BASE_URL}/service-orders/${osId}`,
    JSON.stringify({ status }), auth);

  check(moveTo('DIAGNOSIS'), { 'DIAGNOSIS': (r) => r.status === 200 });
  check(moveTo('WAITING_APPROVAL'), { 'WAITING_APPROVAL': (r) => r.status === 200 });

  // Approval belongs to the customer: separate route, token and code.
  const customerToken = authenticate(`${BASE_URL}/auth/cpf`, { cpf: TAX_ID });
  if (customerToken) {
    const r = http.patch(`${BASE_URL}/service-orders/${osId}/budget`,
      JSON.stringify({ status: 'APPROVED', code: BUDGET_CODE }),
      { headers: { ...JSON_HEADERS, authorization: `Bearer ${customerToken}` } });
    check(r, { 'budget approved': (x) => x.status === 200 });
  }

  check(moveTo('EXECUTION'), { 'EXECUTION': (r) => r.status === 200 });
  check(moveTo('FINISHED'), { 'FINISHED': (r) => r.status === 200 });
  check(moveTo('DELIVERED'), { 'DELIVERED': (r) => r.status === 200 });
}

export function customerAuth() {
  const token = authenticate(`${BASE_URL}/auth/cpf`, { cpf: TAX_ID });
  check(token, { 'customer token issued': (t) => !!t });
  if (!token) return;

  const r = http.get(`${BASE_URL}/service-orders`,
    { headers: { authorization: `Bearer ${token}` } });
  check(r, { 'customer reads their own service orders': (x) => x.status === 200 });
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
