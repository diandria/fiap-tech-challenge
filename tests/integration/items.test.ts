import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/app';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testSetup';
import { MongoUserRepository } from '../../src/infrastructure/persistence/repositories/MongoUserRepository';
import { RegisterUseCase } from '../../src/application/use-cases/auth/RegisterUseCase';
import { MongoItemRepository } from '../../src/infrastructure/persistence/repositories/MongoItemRepository';

let app: Application;
let adminToken: string;

const validItem = { name: 'Oil Filter', price: 25, stockQuantity: 10 };

async function seedAdmin(): Promise<void> {
  const repo = new MongoUserRepository();
  const register = new RegisterUseCase(repo);
  await register.execute({ email: 'admin@test.com', password: 'adminpass', role: 'admin' });
  const res = await request(app).post('/auth/login').send({ email: 'admin@test.com', password: 'adminpass' });
  adminToken = res.body.token;
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await connectTestDB();
  app = createApp();
  await seedAdmin();
});

afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearTestDB(); });

describe('POST /items', () => {
  it('GIVEN a valid item payload WHEN POST /items as admin THEN returns 201 AND reservedQuantity is 0', async () => {
    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validItem);
    expect(res.status).toBe(201);
    expect(res.body.reservedQuantity).toBe(0);
    expect(res.body.stockQuantity).toBe(10);
  });

  it('GIVEN a negative price WHEN POST /items THEN returns 400', async () => {
    const res = await request(app)
      .post('/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validItem, price: -1 });
    expect(res.status).toBe(400);
  });
});

describe('GET /items', () => {
  it('GIVEN one item in inventory WHEN GET /items as admin THEN returns array with availableQuantity computed', async () => {
    await request(app).post('/items').set('Authorization', `Bearer ${adminToken}`).send(validItem);
    const res = await request(app).get('/items').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body[0].availableQuantity).toBe(10);
  });
});

describe('DELETE /items/:id', () => {
  it('GIVEN an item with no reservations WHEN DELETE /items/:id THEN returns 204', async () => {
    const created = await request(app).post('/items').set('Authorization', `Bearer ${adminToken}`).send(validItem);
    const del = await request(app).delete(`/items/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(204);
  });

  it('GIVEN an item with active reservations WHEN DELETE /items/:id THEN returns 400 with reserved message', async () => {
    const created = await request(app).post('/items').set('Authorization', `Bearer ${adminToken}`).send(validItem);
    const itemRepo = new MongoItemRepository();
    await itemRepo.update(created.body.id, { reservedQuantity: 3 });

    const res = await request(app)
      .delete(`/items/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reserved/i);
  });
});
