import express, { Application, Request, Response, NextFunction } from 'express';
import { errorMiddleware } from './infrastructure/http/middlewares/errorMiddleware';

export function createApp(): Application {
  const app = express();

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

  // Routes registered here in subsequent tasks

  app.use(errorMiddleware);

  return app;
}
