import request from 'supertest';
import express, { Router } from 'express';
import { registry } from '../../../../src/frameworks/metrics/registry';
import { requestLoggerMiddleware } from '../../../../src/frameworks/http/middlewares/requestLoggerMiddleware';
import { traceContextMiddleware } from '../../../../src/frameworks/http/middlewares/traceContextMiddleware';

function appWith(mount: (app: express.Application) => void): express.Application {
  const app = express();
  app.use(traceContextMiddleware);
  app.use(requestLoggerMiddleware());
  mount(app);
  return app;
}

/**
 * Extracts the values of the route label from the exposition format.
 *
 * Searching for the concrete path as a loose substring over the whole text
 * would be brittle: the histogram's accumulated values are floats, and a digit
 * sequence like 9999 shows up inside a _sum without any series carrying that
 * path existing at all.
 */
async function routeLabels(): Promise<string[]> {
  const text = await registry.metrics();
  return [...text.matchAll(/route="([^"]*)"/g)].map((m) => m[1]);
}

describe('http latency histogram', () => {
  it('should record the route template GIVEN a parametrized route WHEN a request completes', async () => {
    const app = appWith((a) => a.get('/service-orders/:id', (_req, res) => res.status(200).json({})));

    await request(app).get('/service-orders/abc-123');

    const routes = await routeLabels();
    expect(routes).toContain('/service-orders/:id');
    // Guards cardinality: without this assertion, the regression only shows up
    // once Prometheus already holds thousands of series.
    expect(routes).not.toContain('/service-orders/abc-123');
  });

  it('should label the status code GIVEN a 404 WHEN a request completes', async () => {
    const app = appWith((a) => a.get('/x', (_req, res) => res.status(404).json({})));

    await request(app).get('/x');

    expect(await registry.metrics()).toContain('status_code="404"');
  });

  it('should keep the mount prefix GIVEN a router mounted under a path WHEN a request completes', async () => {
    // This project's routers are mounted with a prefix and declare '/:id'
    // inside. Without the prefix, /customers/:id and /service-orders/:id would
    // collapse into the same label and the panels would add different endpoints
    // into one series.
    const customers = Router();
    customers.get('/:id', (_req, res) => res.status(200).json({}));
    const app = appWith((a) => a.use('/customers', customers));

    await request(app).get('/customers/11111111-1111-1111-1111-111111111111');

    expect(await routeLabels()).toContain('/customers/:id');
  });

  it('should collapse unmatched paths into a single series GIVEN no route matches WHEN a request completes', async () => {
    // A path with no matching route has no template. Using the concrete path
    // here would let any URL scan create a new time series per request.
    const app = appWith((a) => a.get('/known', (_req, res) => res.status(200).json({})));

    await request(app).get('/no-such-route/9999');

    const routes = await routeLabels();
    expect(routes).toContain('unmatched');
    expect(routes).not.toContain('/no-such-route/9999');
  });
});
