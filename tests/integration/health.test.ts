import request from 'supertest';
import { createApp } from '../../src/app';
import { Router } from 'express';

function emptyRouter(): Router {
  return Router();
}

const app = createApp({
  auth: emptyRouter(),
  customers: emptyRouter(),
  vehicles: emptyRouter(),
  services: emptyRouter(),
  items: emptyRouter(),
  serviceOrders: emptyRouter(),
});

describe('Health endpoints', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /ready returns 200 with status ready', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready' });
  });

});
