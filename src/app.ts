import express, { Application, Request, Response, NextFunction, Router } from 'express';
import helmet from 'helmet';
import { errorMiddleware } from './frameworks/http/middlewares/errorMiddleware';
import { traceContextMiddleware } from './frameworks/http/middlewares/traceContextMiddleware';
import { requestLoggerMiddleware } from './frameworks/http/middlewares/requestLoggerMiddleware';
import { setupSwagger } from './frameworks/http/swagger/setup';
import { healthRoutes, ReadinessCheck } from './frameworks/http/routes/healthRoutes';

interface AppRoutes {
  auth: Router;
  customers: Router;
  vehicles: Router;
  services: Router;
  items: Router;
  serviceOrders: Router;
}

export function createApp(routes: AppRoutes, checkDatabase: ReadinessCheck): Application {
  const app = express();

  // Without this, req.ip is the address of whatever opened the TCP connection.
  // In the deployed environment that is one of the API Gateway managed ENIs, so
  // every caller in the world shares a single rate-limit bucket: ten logins per
  // fifteen minutes for the entire system.
  //
  // TRUST_PROXY_HOPS says how many proxies sit in front. One covers the API
  // Gateway, which appends the caller's address to X-Forwarded-For; the NLB is
  // layer 4 and adds no hop. Trusting the header is only safe because the
  // gateway is the single entry point (ADR-001) and the NLB is internal -- a
  // parallel path would make it forgeable.
  //
  // Left off by default so local and test runs read the real socket address.
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
  if (trustProxyHops > 0) app.set('trust proxy', trustProxyHops);

  // First of all: every later event, the error one included, needs the trace
  // context to be available.
  app.use(traceContextMiddleware);
  app.use(requestLoggerMiddleware());

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );
  app.use(express.json());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const allowedOrigins = (process.env.CORS_ORIGIN ?? '').split(',');
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  setupSwagger(app);

  app.use('/', healthRoutes(checkDatabase));

  app.use('/auth', routes.auth);
  app.use('/customers', routes.customers);
  app.use('/vehicles', routes.vehicles);
  app.use('/services', routes.services);
  app.use('/items', routes.items);
  app.use('/service-orders', routes.serviceOrders);

  app.use(errorMiddleware);

  return app;
}
