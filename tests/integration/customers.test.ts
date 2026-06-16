import request from 'supertest';
import { Application } from 'express';

import { connectTestDB, disconnectTestDB, clearTestDB, createTestApp } from '../helpers/testSetup';
import { MongoUserRepository } from '../../src/adapters/gateways/MongoUserRepository';
import { RegisterUseCase } from '../../src/use-cases/auth/RegisterUseCase';

let app: Application;
let adminToken: string;
let attendantToken: string;
let mechanicToken: string;

const validCustomer = {
  name: 'João Silva',
  taxId: '529.982.247-25',
  taxType: 'CPF',
  email: 'joao@test.com',
  phone: '11999990000',
};

async function seedTokens(): Promise<void> {
  const repo = new MongoUserRepository();
  const register = new RegisterUseCase(repo);
  await register.execute({ email: 'admin@test.com', password: 'adminpass', role: 'admin' });
  await register.execute({ email: 'attendant@test.com', password: 'attpass', role: 'attendant' });
  await register.execute({ email: 'mechanic@test.com', password: 'mechpass', role: 'mechanic' });

  const adminRes = await request(app).post('/auth/login').send({ email: 'admin@test.com', password: 'adminpass' });
  adminToken = adminRes.body.token;

  const attRes = await request(app).post('/auth/login').send({ email: 'attendant@test.com', password: 'attpass' });
  attendantToken = attRes.body.token;

  const mechRes = await request(app).post('/auth/login').send({ email: 'mechanic@test.com', password: 'mechpass' });
  mechanicToken = mechRes.body.token;
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await connectTestDB();
  app = createTestApp();
  await seedTokens();
});

afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearTestDB(); });

describe('POST /customers', () => {
  it('GIVEN a valid CPF WHEN POST /customers as attendant THEN returns 201 with customer data', async () => {
    const res = await request(app)
      .post('/customers')
      .set('Authorization', `Bearer ${attendantToken}`)
      .send(validCustomer);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.taxId).toBe('52998224725'); // formatted input stripped to digits
  });

  it('GIVEN a valid CNPJ WHEN POST /customers as admin THEN returns 201', async () => {
    const res = await request(app)
      .post('/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validCustomer, taxId: '11.222.333/0001-81', taxType: 'CNPJ' });
    expect(res.status).toBe(201);
  });

  it('GIVEN an invalid CPF WHEN POST /customers THEN returns 400', async () => {
    const res = await request(app)
      .post('/customers')
      .set('Authorization', `Bearer ${attendantToken}`)
      .send({ ...validCustomer, taxId: '111.111.111-11' });
    expect(res.status).toBe(400);
  });

  it('GIVEN an existing customer WHEN POST /customers with the same CPF/CNPJ THEN returns 409', async () => {
    await request(app).post('/customers').set('Authorization', `Bearer ${adminToken}`).send(validCustomer);
    const res = await request(app).post('/customers').set('Authorization', `Bearer ${adminToken}`).send(validCustomer);
    expect(res.status).toBe(409);
  });

  it('GIVEN no Authorization header WHEN POST /customers THEN returns 401', async () => {
    const res = await request(app).post('/customers').send(validCustomer);
    expect(res.status).toBe(401);
  });
});

describe('GET /customers', () => {
  it('GIVEN one registered customer WHEN GET /customers THEN returns array with one item', async () => {
    await request(app).post('/customers').set('Authorization', `Bearer ${adminToken}`).send(validCustomer);
    const res = await request(app).get('/customers').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

describe('GET /customers/:id', () => {
  it('GIVEN an existing customer WHEN GET /customers/:id THEN returns the customer', async () => {
    const created = await request(app).post('/customers').set('Authorization', `Bearer ${adminToken}`).send(validCustomer);
    const res = await request(app).get(`/customers/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('João Silva');
  });

  it('GIVEN a non-existent id WHEN GET /customers/:id THEN returns 404', async () => {
    const res = await request(app).get('/customers/000000000000000000000000').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});

describe('PUT /customers/:id', () => {
  it('GIVEN an existing customer WHEN PUT /customers/:id with a new name THEN returns 200 with updated data', async () => {
    const created = await request(app).post('/customers').set('Authorization', `Bearer ${adminToken}`).send(validCustomer);
    const res = await request(app)
      .put(`/customers/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'João Atualizado' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('João Atualizado');
  });
});

describe('DELETE /customers/:id', () => {
  it('GIVEN an existing customer WHEN DELETE /customers/:id THEN returns 204 AND subsequent GET returns 404', async () => {
    const created = await request(app).post('/customers').set('Authorization', `Bearer ${adminToken}`).send(validCustomer);
    const del = await request(app).delete(`/customers/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);
    const get = await request(app).get(`/customers/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(get.status).toBe(404);
  });
});

describe('Role Authorization — /customers', () => {
  it('GIVEN a mechanic token WHEN GET /customers THEN returns 403', async () => {
    const res = await request(app).get('/customers').set('Authorization', `Bearer ${mechanicToken}`);
    expect(res.status).toBe(403);
  });

  it('GIVEN a mechanic token WHEN POST /customers THEN returns 403', async () => {
    const res = await request(app).post('/customers').set('Authorization', `Bearer ${mechanicToken}`).send(validCustomer);
    expect(res.status).toBe(403);
  });

  it('GIVEN no Authorization header WHEN GET /customers THEN returns 401', async () => {
    const res = await request(app).get('/customers');
    expect(res.status).toBe(401);
  });

  it('GIVEN no Authorization header WHEN GET /customers/:id THEN returns 401', async () => {
    const res = await request(app).get('/customers/000000000000000000000000');
    expect(res.status).toBe(401);
  });

  it('GIVEN no Authorization header WHEN PUT /customers/:id THEN returns 401', async () => {
    const res = await request(app).put('/customers/000000000000000000000000').send({ name: 'x' });
    expect(res.status).toBe(401);
  });

  it('GIVEN no Authorization header WHEN DELETE /customers/:id THEN returns 401', async () => {
    const res = await request(app).delete('/customers/000000000000000000000000');
    expect(res.status).toBe(401);
  });
});
