import express, { Application, Request, Response, NextFunction, Router } from 'express';
import helmet from 'helmet';
import { errorMiddleware } from './frameworks/http/middlewares/errorMiddleware';
import { setupSwagger } from './frameworks/http/swagger/setup';

interface AppRoutes {
  auth: Router;
  customers: Router;
  vehicles: Router;
  services: Router;
  items: Router;
  serviceOrders: Router;
}

export function createApp(routes: AppRoutes): Application {
  const app = express();

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

  app.use('/auth', routes.auth);
  app.use('/customers', routes.customers);
  app.use('/vehicles', routes.vehicles);
  app.use('/services', routes.services);
  app.use('/items', routes.items);
  app.use('/service-orders', routes.serviceOrders);

  app.use(errorMiddleware);

  return app;
}
