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

  // Liveness does not query the database on purpose. Failing here restarts the
  // pod, and restarting does not fix a database that is down: the effect would
  // be a restart loop for the duration of the incident.
  router.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  // Readiness does query: a pod that cannot reach the database should not take
  // traffic, and pulling it out of the Service is exactly what the 503 does.
  router.get('/ready', async (_req, res) => {
    try {
      await withTimeout(checkDatabase);
      res.status(200).json({ status: 'ready', checks: { database: 'up' } });
    } catch {
      res.status(503).json({ status: 'not-ready', checks: { database: 'down' } });
    }
  });

  // No authentication and no rate limit: Prometheus scrapes from inside the
  // cluster, with no credential, at a fixed interval.
  router.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  return router;
}
