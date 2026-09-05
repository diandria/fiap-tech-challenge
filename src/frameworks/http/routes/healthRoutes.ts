import { Router } from 'express';
import { registry } from '../../metrics/registry';

/**
 * Dependency check for the readiness probe. Throws when the dependency does not
 * answer.
 *
 * It is a function, and not the PrismaClient, so the HTTP layer does not come
 * to know the database: swapping the persistence technology should not reach
 * the probe routes.
 */
export type ReadinessCheck = () => Promise<unknown>;

const READINESS_TIMEOUT_MS = 2000;

function withTimeout(check: ReadinessCheck): Promise<unknown> {
  let timer: NodeJS.Timeout;
  const expiry = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('readiness check timed out')), READINESS_TIMEOUT_MS);
  });
  return Promise.race([check(), expiry]).finally(() => clearTimeout(timer));
}

export function healthRoutes(checkDatabase: ReadinessCheck): Router {
  const router = Router();

  // Liveness does not query the database on purpose: restarting the pod does
  // not fix a database that is down, it just loops through the incident.
  router.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  // Readiness does query: the 503 pulls the pod out of the Service.
  router.get('/ready', async (_req, res) => {
    try {
      await withTimeout(checkDatabase);
      res.status(200).json({ status: 'ready', checks: { database: 'up' } });
    } catch {
      res.status(503).json({ status: 'not-ready', checks: { database: 'down' } });
    }
  });

  // No auth and no rate limit: Prometheus scrapes from inside the cluster.
  router.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  return router;
}
