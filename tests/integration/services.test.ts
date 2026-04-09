import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/app';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testSetup';
import { MongoUserRepository } from '../../src/infrastructure/persistence/repositories/MongoUserRepository';
import { RegisterUseCase } from '../../src/application/use-cases/auth/RegisterUseCase';

let app: Application;
let adminToken: string;
let mechanicToken: string;
let attendantToken: string;

const validService = { name: 'Oil Change', price: 80, estimatedMinutes: 30 };

async function seedTokens(): Promise<void> {
  const repo = new MongoUserRepository();
  const register = new RegisterUseCase(repo);
  await register.execute({ email: 'admin@test.com', password: 'adminpass', role: 'admin' });
  await register.execute({ email: 'mechanic@test.com', password: 'mechpass', role: 'mechanic' });
  await register.execute({ email: 'attendant@test.com', password: 'attpass', role: 'attendant' });
  const adminRes = await request(app).post('/auth/login').send({ email: 'admin@test.com', password: 'adminpass' });
  adminToken = adminRes.body.token;
  const mechRes = await request(app).post('/auth/login').send({ email: 'mechanic@test.com', password: 'mechpass' });
  mechanicToken = mechRes.body.token;
  const attRes = await request(app).post('/auth/login').send({ email: 'attendant@test.com', password: 'attpass' });
  attendantToken = attRes.body.token;
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await connectTestDB();
  app = createApp();
  await seedTokens();
});

afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearTestDB(); });

describe('GET /services', () => {
  it('GIVEN one service in catalog WHEN GET /services without auth THEN returns 200 with array', async () => {
    await request(app).post('/services').set('Authorization', `Bearer ${adminToken}`).send(validService);
    const res = await request(app).get('/services');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

describe('POST /services', () => {
  it('GIVEN a valid service payload WHEN POST /services as admin THEN returns 201', async () => {
    const res = await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validService);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Oil Change');
  });

  it('GIVEN a mechanic token WHEN POST /services THEN returns 403', async () => {
    const res = await request(app)
      .post('/services')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send(validService);
    expect(res.status).toBe(403);
  });
});

describe('PUT /services/:id', () => {
  it('GIVEN an existing service WHEN PUT /services/:id with new price as admin THEN returns 200 with updated price', async () => {
    const created = await request(app).post('/services').set('Authorization', `Bearer ${adminToken}`).send(validService);
    const res = await request(app)
      .put(`/services/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 100 });
    expect(res.status).toBe(200);
    expect(res.body.price).toBe(100);
  });
});

describe('DELETE /services/:id', () => {
  it('GIVEN an existing service WHEN DELETE /services/:id as admin THEN returns 204', async () => {
    const created = await request(app).post('/services').set('Authorization', `Bearer ${adminToken}`).send(validService);
    const del = await request(app).delete(`/services/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);
  });
});

describe('Role Authorization — /services', () => {
  it('mechanic can GET /services/:id', async () => {
    const created = await request(app).post('/services').set('Authorization', `Bearer ${adminToken}`).send(validService);
    const res = await request(app).get(`/services/${created.body.id}`).set('Authorization', `Bearer ${mechanicToken}`);
    expect(res.status).toBe(200);
  });

  it('attendant can GET /services/:id', async () => {
    const created = await request(app).post('/services').set('Authorization', `Bearer ${adminToken}`).send(validService);
    const res = await request(app).get(`/services/${created.body.id}`).set('Authorization', `Bearer ${attendantToken}`);
    expect(res.status).toBe(200);
  });

  it('no auth gets 401 on GET /services/:id', async () => {
    const created = await request(app).post('/services').set('Authorization', `Bearer ${adminToken}`).send(validService);
    const res = await request(app).get(`/services/${created.body.id}`);
    expect(res.status).toBe(401);
  });

  it('attendant gets 403 on POST /services', async () => {
    const res = await request(app).post('/services').set('Authorization', `Bearer ${attendantToken}`).send(validService);
    expect(res.status).toBe(403);
  });

  it('attendant gets 403 on PUT /services/:id', async () => {
    const created = await request(app).post('/services').set('Authorization', `Bearer ${adminToken}`).send(validService);
    const res = await request(app).put(`/services/${created.body.id}`).set('Authorization', `Bearer ${attendantToken}`).send({ price: 99 });
    expect(res.status).toBe(403);
  });

  it('attendant gets 403 on DELETE /services/:id', async () => {
    const created = await request(app).post('/services').set('Authorization', `Bearer ${adminToken}`).send(validService);
    const res = await request(app).delete(`/services/${created.body.id}`).set('Authorization', `Bearer ${attendantToken}`);
    expect(res.status).toBe(403);
  });

  it('no auth gets 401 on POST /services', async () => {
    const res = await request(app).post('/services').send(validService);
    expect(res.status).toBe(401);
  });

  it('no auth gets 401 on PUT /services/:id', async () => {
    const res = await request(app).put('/services/000000000000000000000000').send({ price: 99 });
    expect(res.status).toBe(401);
  });

  it('no auth gets 401 on DELETE /services/:id', async () => {
    const res = await request(app).delete('/services/000000000000000000000000');
    expect(res.status).toBe(401);
  });
});
