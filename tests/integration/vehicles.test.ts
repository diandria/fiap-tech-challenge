import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/app';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testSetup';
import { MongoUserRepository } from '../../src/infrastructure/persistence/repositories/MongoUserRepository';
import { RegisterUseCase } from '../../src/application/use-cases/auth/RegisterUseCase';

let app: Application;
let adminToken: string;
let attendantToken: string;
let mechanicToken: string;

const validVehicle = {
  customerId: 'c-placeholder',
  plate: 'ABC-1234',
  brand: 'Toyota',
  model: 'Corolla',
  year: 2020,
};

async function seedAdmin(): Promise<void> {
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
  app = createApp();
  await seedAdmin();
});

afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearTestDB(); });

describe('POST /vehicles', () => {
  it('GIVEN a valid old-format plate WHEN POST /vehicles as admin THEN returns 201', async () => {
    const res = await request(app)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validVehicle);
    expect(res.status).toBe(201);
    expect(res.body.plate).toBe('ABC-1234');
  });

  it('GIVEN a valid Mercosul plate WHEN POST /vehicles THEN returns 201', async () => {
    const res = await request(app)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validVehicle, plate: 'ABC1D23' });
    expect(res.status).toBe(201);
  });

  it('GIVEN an invalid plate format WHEN POST /vehicles THEN returns 400', async () => {
    const res = await request(app)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validVehicle, plate: 'INVALID' });
    expect(res.status).toBe(400);
  });

  it('GIVEN an existing vehicle WHEN POST /vehicles with the same plate THEN returns 409', async () => {
    await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send(validVehicle);
    const res = await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send(validVehicle);
    expect(res.status).toBe(409);
  });
});

describe('GET /vehicles', () => {
  it('GIVEN one registered vehicle WHEN GET /vehicles THEN returns array with one item', async () => {
    await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send(validVehicle);
    const res = await request(app).get('/vehicles').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('GIVEN vehicles for two different customers WHEN GET /vehicles?customerId=c-1 THEN returns only vehicles for c-1', async () => {
    await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send({ ...validVehicle, customerId: 'c-1' });
    await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send({ ...validVehicle, plate: 'XYZ9W87', customerId: 'c-2' });
    const res = await request(app).get('/vehicles?customerId=c-1').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].customerId).toBe('c-1');
  });
});

describe('DELETE /vehicles/:id', () => {
  it('GIVEN an existing vehicle WHEN DELETE /vehicles/:id THEN returns 204', async () => {
    const created = await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send(validVehicle);
    const del = await request(app).delete(`/vehicles/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);
  });
});

describe('Role Authorization — /vehicles', () => {
  it('attendant can POST /vehicles', async () => {
    const res = await request(app).post('/vehicles').set('Authorization', `Bearer ${attendantToken}`).send(validVehicle);
    expect(res.status).toBe(201);
  });

  it('attendant can GET /vehicles', async () => {
    const res = await request(app).get('/vehicles').set('Authorization', `Bearer ${attendantToken}`);
    expect(res.status).toBe(200);
  });

  it('mechanic gets 403 on GET /vehicles', async () => {
    const res = await request(app).get('/vehicles').set('Authorization', `Bearer ${mechanicToken}`);
    expect(res.status).toBe(403);
  });

  it('mechanic gets 403 on POST /vehicles', async () => {
    const res = await request(app).post('/vehicles').set('Authorization', `Bearer ${mechanicToken}`).send(validVehicle);
    expect(res.status).toBe(403);
  });

  it('no auth gets 401 on GET /vehicles', async () => {
    const res = await request(app).get('/vehicles');
    expect(res.status).toBe(401);
  });

  it('no auth gets 401 on POST /vehicles', async () => {
    const res = await request(app).post('/vehicles').send(validVehicle);
    expect(res.status).toBe(401);
  });
});
