import { Router } from 'express';
import { registry } from '../../metrics/registry';

export function healthRoutes(): Router {
  const router = Router();
  router.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
  router.get('/ready', (_req, res) => res.status(200).json({ status: 'ready' }));

  // Sem autenticacao e sem rate limit: o Prometheus raspa de dentro do cluster,
  // sem credencial, e em intervalo fixo.
  router.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  return router;
}
