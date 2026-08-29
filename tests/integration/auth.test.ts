import request from 'supertest';

import { connectTestDB, disconnectTestDB, clearTestDB, createTestApp, prisma } from '../helpers/testSetup';
import { Application } from 'express';

describe('Auth Integration', () => {
  let app: Application;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'integration-test-secret';
    await connectTestDB();
    app = createTestApp();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  describe('POST /auth/register', () => {
    it('GIVEN no Authorization header WHEN POST /auth/register THEN returns 401', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'a@test.com', password: 'pass123', role: 'attendant' });
      expect(res.status).toBe(401);
    });

    it('GIVEN a valid admin token WHEN POST /auth/register with new credentials THEN returns 201 AND omits passwordHash', async () => {
      // First create an admin directly via the repo to bootstrap
      const { PostgresUserRepository } = await import('../../src/adapters/gateways/PostgresUserRepository');
      const { RegisterUseCase } = await import('../../src/use-cases/auth/RegisterUseCase');
      const repo = new PostgresUserRepository(prisma);
      const register = new RegisterUseCase(repo);
      await register.execute({ email: 'admin@test.com', password: 'adminpass', role: 'admin' });

      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@test.com', password: 'adminpass' });
      const adminToken = loginRes.body.token;

      const res = await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'attendant@test.com', password: 'pass123', role: 'attendant' });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe('attendant@test.com');
      expect(res.body.role).toBe('attendant');
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('GIVEN an existing email WHEN POST /auth/register with the same email THEN returns 409', async () => {
      const { PostgresUserRepository } = await import('../../src/adapters/gateways/PostgresUserRepository');
      const { RegisterUseCase } = await import('../../src/use-cases/auth/RegisterUseCase');
      const repo = new PostgresUserRepository(prisma);
      const register = new RegisterUseCase(repo);
      await register.execute({ email: 'admin@test.com', password: 'adminpass', role: 'admin' });

      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@test.com', password: 'adminpass' });
      const adminToken = loginRes.body.token;

      await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'dupe@test.com', password: 'pass', role: 'mechanic' });

      const res = await request(app)
        .post('/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'dupe@test.com', password: 'pass', role: 'mechanic' });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      const { PostgresUserRepository } = await import('../../src/adapters/gateways/PostgresUserRepository');
      const { RegisterUseCase } = await import('../../src/use-cases/auth/RegisterUseCase');
      const repo = new PostgresUserRepository(prisma);
      const register = new RegisterUseCase(repo);
      await register.execute({ email: 'user@test.com', password: 'correct', role: 'mechanic' });
    });

    it('GIVEN a registered user WHEN POST /auth/login with correct password THEN returns 200 with a JWT', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'user@test.com', password: 'correct' });
      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
    });

    it('GIVEN a registered user WHEN POST /auth/login with wrong password THEN returns 401', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'user@test.com', password: 'wrong' });
      expect(res.status).toBe(401);
    });

    it('GIVEN no registered user WHEN POST /auth/login THEN returns 401', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'nobody@test.com', password: 'pass' });
      expect(res.status).toBe(401);
    });
  });
});
