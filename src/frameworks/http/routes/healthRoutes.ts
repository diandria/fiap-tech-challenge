import { Router } from 'express';

export function healthRoutes(): Router {
  const router = Router();
  router.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
  router.get('/ready', (_req, res) => res.status(200).json({ status: 'ready' }));
  return router;
}
