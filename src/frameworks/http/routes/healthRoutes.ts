import { Router } from 'express';
import { registry } from '../../metrics/registry';

/**
 * Dependency check for the readiness probe. Throws when the dependency does
 * not answer. A function, not the PrismaClient, so the HTTP layer stays
 * unaware of the persistence technology.
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
  const startedAt = new Date().toISOString();

  // Liveness skips the database check: restarting the pod would not fix a
  // database outage and would cause a restart loop. It also reports the
  // version the deploy wrote, the commit SHA, which the logs and traces carry
  // too: what is running can be checked through the gateway. The start time
  // tells a fresh rollout, or a pod the kubelet restarted, from one that has
  // been up all along.
  router.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      version: process.env.SERVICE_VERSION ?? '0.0.0',
      startedAt,
    });
  });

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
