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
    expect(res.body).toEqual({ status: 'ok' });
  });

  // O teste que impede um erro caro: liveness nao checa o banco. Falhar ali
  // reinicia o pod, e reiniciar nao conserta um banco fora. O resultado seria um
  // laco de reinicios durante um incidente que ja e ruim o suficiente.
  it('should still return 200 GIVEN the database is unreachable WHEN liveness is probed', async () => {
    const res = await request(appWith(unreachable)).get('/health');

    expect(res.status).toBe(200);
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

  // Sem limite de tempo a sonda fica pendurada e o kubelet a mata pelo timeout
  // dele: mesmo efeito, diagnostico pior.
  it('should return 503 GIVEN the check hangs WHEN readiness is probed', async () => {
    const hangs: ReadinessCheck = () => new Promise(() => undefined);

    const res = await request(appWith(hangs)).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body.checks.database).toBe('down');
  }, 10000);
});
