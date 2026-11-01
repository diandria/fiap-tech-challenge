import jwt from 'jsonwebtoken';
import request from 'supertest';

/** Where e2e/docker-compose.yml publishes each service. */
const urls = {
  os: process.env.E2E_OS_URL ?? 'http://localhost:3000',
  billing: process.env.E2E_BILLING_URL ?? 'http://localhost:3001',
  execution: process.env.E2E_EXECUTION_URL ?? 'http://localhost:3002',
};

/** The secret the three services share in the compose stack. */
const JWT_SECRET = process.env.E2E_JWT_SECRET ?? 'dev-secret-change-in-prod';

export interface HttpAnswer<T = Record<string, unknown>> {
  status: number;
  body: T;
}

/** A service reached over HTTP with one bearer token, as a client behind the gateway would. */
export class ServiceClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  async get<T = Record<string, unknown>>(path: string): Promise<HttpAnswer<T>> {
    const res = await request(this.baseUrl).get(path).set('Authorization', `Bearer ${this.token}`);
    return { status: res.status, body: res.body };
  }

  async post<T = Record<string, unknown>>(path: string, body: object = {}): Promise<HttpAnswer<T>> {
    const res = await request(this.baseUrl).post(path).set('Authorization', `Bearer ${this.token}`).send(body);
    return { status: res.status, body: res.body };
  }

  async patch<T = Record<string, unknown>>(path: string, body: object): Promise<HttpAnswer<T>> {
    const res = await request(this.baseUrl).patch(path).set('Authorization', `Bearer ${this.token}`).send(body);
    return { status: res.status, body: res.body };
  }
}

/** Fails the step with what the service answered, instead of a bare status mismatch. */
export function expectStatus<T>(answer: HttpAnswer<T>, expected: number, what: string): T {
  if (answer.status !== expected) {
    throw new Error(`${what} answered ${answer.status}, expected ${expected}: ${JSON.stringify(answer.body)}`);
  }
  return answer.body;
}

/** Logs in as the admin the OS seeds at startup, through the real login route. */
export async function staffClients(): Promise<{ os: ServiceClient; billing: ServiceClient; execution: ServiceClient }> {
  const res = await request(urls.os).post('/auth/login').send({
    email: process.env.E2E_ADMIN_EMAIL ?? 'admin@master.com',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'change-me-in-production',
  });
  if (res.status !== 200) throw new Error(`admin login answered ${res.status}: ${JSON.stringify(res.body)}`);
  const token: string = res.body.token;
  return {
    os: new ServiceClient(urls.os, token),
    billing: new ServiceClient(urls.billing, token),
    execution: new ServiceClient(urls.execution, token),
  };
}

/**
 * The token the authentication function would issue. The function does not
 * run in the compose stack, so the scenario signs it with the shared secret,
 * as the integration tests do.
 */
export function customerBilling(customerId: string, cpf: string): ServiceClient {
  const token = jwt.sign({ type: 'customer', sub: customerId, cpf, name: 'E2E Customer' }, JWT_SECRET);
  return new ServiceClient(urls.billing, token);
}
