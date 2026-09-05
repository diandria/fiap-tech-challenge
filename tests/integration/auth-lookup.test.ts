import request from 'supertest';
import { Application } from 'express';

import { connectTestDB, disconnectTestDB, clearTestDB, createTestApp, prisma } from '../helpers/testSetup';
import { buildSwaggerSpec } from '../../src/frameworks/http/swagger/setup';

const INTERNAL_TOKEN = 'integration-test-internal-token';
const VALID_CPF = '52998224725';
const UNREGISTERED_CPF = '12345678909';

describe('POST /auth/customers/lookup', () => {
  let app: Application;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'integration-test-secret';
    process.env.INTERNAL_TOKEN = INTERNAL_TOKEN;
    await connectTestDB();
    app = createTestApp();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  async function createCustomer(taxId = VALID_CPF) {
    return prisma.customer.create({
      data: {
        name: 'Ana Souza',
        taxId,
        taxType: 'CPF',
        email: 'ana@test.com',
        phone: '11999999999',
      },
    });
  }

  it('should return 401 GIVEN no internal token WHEN called', async () => {
    const res = await request(app).post('/auth/customers/lookup').send({ cpf: VALID_CPF });

    expect(res.status).toBe(401);
  });

  it('should return 401 GIVEN a wrong internal token WHEN called', async () => {
    const res = await request(app)
      .post('/auth/customers/lookup')
      .set('x-internal-token', 'errado')
      .send({ cpf: VALID_CPF });

    expect(res.status).toBe(401);
  });

  // Same length, different content: covers the constant-time comparison.
  it('should return 401 GIVEN a token of the same length but different content WHEN called', async () => {
    const res = await request(app)
      .post('/auth/customers/lookup')
      .set('x-internal-token', 'X'.repeat(INTERNAL_TOKEN.length))
      .send({ cpf: VALID_CPF });

    expect(res.status).toBe(401);
  });

  it('should return 400 GIVEN an invalid cpf WHEN called', async () => {
    const res = await request(app)
      .post('/auth/customers/lookup')
      .set('x-internal-token', INTERNAL_TOKEN)
      .send({ cpf: '11111111111' });

    expect(res.status).toBe(400);
  });

  it('should return the customer GIVEN a valid cpf of an existing customer WHEN called', async () => {
    const customer = await createCustomer();

    const res = await request(app)
      .post('/auth/customers/lookup')
      .set('x-internal-token', INTERNAL_TOKEN)
      .send({ cpf: '529.982.247-25' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: customer.id, name: customer.name, active: true });
  });

  // The body is a contract with the function: any extra field here leaks
  // personal data out of the application without anyone deciding to.
  it('should not expose personal data beyond the contract GIVEN a found customer WHEN called', async () => {
    await createCustomer();

    const res = await request(app)
      .post('/auth/customers/lookup')
      .set('x-internal-token', INTERNAL_TOKEN)
      .send({ cpf: VALID_CPF });

    expect(Object.keys(res.body).sort()).toEqual(['active', 'id', 'name']);
  });

  it('should return 404 GIVEN a valid cpf with no customer WHEN called', async () => {
    const res = await request(app)
      .post('/auth/customers/lookup')
      .set('x-internal-token', INTERNAL_TOKEN)
      .send({ cpf: UNREGISTERED_CPF });

    expect(res.status).toBe(404);
  });

  it('should report active false GIVEN a soft-deleted customer WHEN called', async () => {
    const customer = await createCustomer();
    await prisma.customer.update({ where: { id: customer.id }, data: { deletedAt: new Date() } });

    const res = await request(app)
      .post('/auth/customers/lookup')
      .set('x-internal-token', INTERNAL_TOKEN)
      .send({ cpf: VALID_CPF });

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
  });

  // The internal route must not appear in the public Swagger spec.
  it('should not document the lookup route in the public swagger spec', () => {
    expect(JSON.stringify(buildSwaggerSpec())).not.toContain('customers/lookup');
  });
});
