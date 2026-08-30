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

  // Primeiro de todos: todo evento posterior, inclusive o de erro, precisa do
  // contexto de rastreamento disponivel.
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

  // CORS
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
