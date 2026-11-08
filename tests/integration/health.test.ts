import request from 'supertest';
import { Application, Router } from 'express';
import { createApp } from '../../src/app';
import { ReadinessCheck } from '../../src/frameworks/http/routes/healthRoutes';

function emptyRouter(): Router {
  return Router();
}

function appWith(checkDatabase: ReadinessCheck): Application {
  return createApp(
    {
      auth: emptyRouter(),
      customers: emptyRouter(),
      vehicles: emptyRouter(),
      services: emptyRouter(),
      items: emptyRouter(),
      serviceOrders: emptyRouter(),
    },
    checkDatabase,
  );
}

const reachable: ReadinessCheck = async () => undefined;
const unreachable: ReadinessCheck = async () => {
  throw new Error('ECONNREFUSED');
};

describe('Liveness', () => {
  it('should return 200 GIVEN the process is running WHEN liveness is probed', async () => {
    const res = await request(appWith(reachable)).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  // Liveness must not check the database: restarting the pod does not fix a
  // database that is down, it just loops through the incident.
  it('should still return 200 GIVEN the database is unreachable WHEN liveness is probed', async () => {
    const res = await request(appWith(unreachable)).get('/health');

    expect(res.status).toBe(200);
  });
});

describe('Version', () => {
  const original = process.env.SERVICE_VERSION;

  afterEach(() => {
    if (original === undefined) delete process.env.SERVICE_VERSION;
    else process.env.SERVICE_VERSION = original;
  });

  it('should report the deployed version GIVEN the deploy set SERVICE_VERSION WHEN liveness is probed', async () => {
    // GIVEN
    process.env.SERVICE_VERSION = 'a1b2c3d';

    // WHEN
    const res = await request(appWith(reachable)).get('/health');

    // THEN
    expect(res.body).toEqual({ status: 'ok', version: 'a1b2c3d' });
  });

  it('should report the same default as the logs and traces GIVEN no SERVICE_VERSION WHEN liveness is probed', async () => {
    // GIVEN
    delete process.env.SERVICE_VERSION;

    // WHEN
    const res = await request(appWith(reachable)).get('/health');

    // THEN
    expect(res.body).toEqual({ status: 'ok', version: '0.0.0' });
  });
});

describe('Readiness', () => {
  it('should return 200 GIVEN the database responds WHEN readiness is probed', async () => {
    const res = await request(appWith(reachable)).get('/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready', checks: { database: 'up' } });
  });

  it('should return 503 GIVEN the database is unreachable WHEN readiness is probed', async () => {
    const res = await request(appWith(unreachable)).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'not-ready', checks: { database: 'down' } });
  });

  // With no time limit the probe hangs and the kubelet kills it anyway, with a
  // worse diagnosis.
  it('should return 503 GIVEN the check hangs WHEN readiness is probed', async () => {
    const hangs: ReadinessCheck = () => new Promise(() => undefined);

    const res = await request(appWith(hangs)).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body.checks.database).toBe('down');
  }, 10000);
});
