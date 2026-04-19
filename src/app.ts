import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { errorMiddleware } from './infrastructure/http/middlewares/errorMiddleware';
import { authRoutes } from './infrastructure/http/routes/authRoutes';
import { customerRoutes } from './infrastructure/http/routes/customerRoutes';
import { vehicleRoutes } from './infrastructure/http/routes/vehicleRoutes';
import { serviceRoutes } from './infrastructure/http/routes/serviceRoutes';
import { itemRoutes } from './infrastructure/http/routes/itemRoutes';
import { serviceOrderRoutes } from './infrastructure/http/routes/serviceOrderRoutes';
import { setupSwagger } from './infrastructure/swagger/setup';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(express.json());

  // CORS
  app.use((req: Request, res: Response, next: NextFunction) => {
    const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',');
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

  app.use('/auth', authRoutes());
  app.use('/customers', customerRoutes());
  app.use('/vehicles', vehicleRoutes());
  app.use('/services', serviceRoutes());
  app.use('/items', itemRoutes());
  app.use('/service-orders', serviceOrderRoutes());

  app.use(errorMiddleware);

  return app;
}
