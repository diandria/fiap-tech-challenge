import request from 'supertest';
import { Application } from 'express';

import { connectTestDB, disconnectTestDB, clearTestDB, createTestApp, prisma } from '../helpers/testSetup';
import { PostgresUserRepository } from '../../src/adapters/gateways/PostgresUserRepository';
import { RegisterUseCase } from '../../src/use-cases/auth/RegisterUseCase';

let app: Application;
let adminToken: string;
let attendantToken: string;
let mechanicToken: string;

// The customer identifier is resolved before each test: with referential
// integrity in the database, an invented value would be refused by the foreign
// key.
let customerId: string;

const baseVehicle = {
  plate: 'ABC-1234',
  brand: 'Toyota',
  model: 'Corolla',
  year: 2020,
};

const validVehicle = (): Record<string, unknown> => ({ ...baseVehicle, customerId });

async function seedCustomer(): Promise<void> {
  const created = await prisma.customer.create({
    data: {
      name: 'Cliente de teste',
      taxId: '12345678909',
      taxType: 'CPF',
      email: 'cliente@test.com',
      phone: '11999999999',
    },
  });
  customerId = created.id;
}

async function seedAdmin(): Promise<void> {
  const repo = new PostgresUserRepository(prisma);
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
  await seedAdmin();
});

afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearTestDB(); });
// Recreated on each test because the clear wipes the customer too.
beforeEach(async () => { await seedCustomer(); });

describe('POST /vehicles', () => {
  it('GIVEN a valid old-format plate WHEN POST /vehicles as admin THEN returns 201', async () => {
    const res = await request(app)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validVehicle());
    expect(res.status).toBe(201);
    expect(res.body.plate).toBe('ABC-1234');
  });

  it('GIVEN a valid Mercosul plate WHEN POST /vehicles THEN returns 201', async () => {
    const res = await request(app)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validVehicle(), plate: 'ABC1D23' });
    expect(res.status).toBe(201);
  });

  it('GIVEN an invalid plate format WHEN POST /vehicles THEN returns 400', async () => {
    const res = await request(app)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validVehicle(), plate: 'INVALID' });
    expect(res.status).toBe(400);
  });

  it('GIVEN an existing vehicle WHEN POST /vehicles with the same plate THEN returns 409', async () => {
    await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send(validVehicle());
    const res = await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send(validVehicle());
    expect(res.status).toBe(409);
  });
});

describe('GET /vehicles', () => {
  it('GIVEN one registered vehicle WHEN GET /vehicles THEN returns array with one item', async () => {
    await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send(validVehicle());
    const res = await request(app).get('/vehicles').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('GIVEN vehicles for two different customers WHEN GET /vehicles filtered by customer THEN returns only that customer vehicles', async () => {
    const other = await prisma.customer.create({
      data: {
        name: 'Outro cliente',
        taxId: '98765432100',
        taxType: 'CPF',
        email: 'outro@test.com',
        phone: '11888888888',
      },
    });

    await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send({ ...validVehicle(), customerId });
    await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send({ ...validVehicle(), plate: 'XYZ9W87', customerId: other.id });
    const res = await request(app).get(`/vehicles?customerId=${customerId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].customerId).toBe(customerId);
  });
});

describe('DELETE /vehicles/:id', () => {
  it('GIVEN an existing vehicle WHEN DELETE /vehicles/:id THEN returns 204', async () => {
    const created = await request(app).post('/vehicles').set('Authorization', `Bearer ${adminToken}`).send(validVehicle());
    const del = await request(app).delete(`/vehicles/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);
  });
});

describe('Role Authorization — /vehicles', () => {
  it('GIVEN an attendant token WHEN POST /vehicles THEN returns 201', async () => {
    const res = await request(app).post('/vehicles').set('Authorization', `Bearer ${attendantToken}`).send(validVehicle());
    expect(res.status).toBe(201);
  });

  it('GIVEN an attendant token WHEN GET /vehicles THEN returns 200', async () => {
    const res = await request(app).get('/vehicles').set('Authorization', `Bearer ${attendantToken}`);
    expect(res.status).toBe(200);
  });

  it('GIVEN a mechanic token WHEN GET /vehicles THEN returns 403', async () => {
    const res = await request(app).get('/vehicles').set('Authorization', `Bearer ${mechanicToken}`);
    expect(res.status).toBe(403);
  });

  it('GIVEN a mechanic token WHEN POST /vehicles THEN returns 403', async () => {
    const res = await request(app).post('/vehicles').set('Authorization', `Bearer ${mechanicToken}`).send(validVehicle());
    expect(res.status).toBe(403);
  });

  it('GIVEN no Authorization header WHEN GET /vehicles THEN returns 401', async () => {
    const res = await request(app).get('/vehicles');
    expect(res.status).toBe(401);
  });

  it('GIVEN no Authorization header WHEN POST /vehicles THEN returns 401', async () => {
    const res = await request(app).post('/vehicles').send(validVehicle());
    expect(res.status).toBe(401);
  });
});
