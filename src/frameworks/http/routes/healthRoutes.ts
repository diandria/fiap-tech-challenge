import { Router } from 'express';
import { registry } from '../../metrics/registry';

/**
 * Verificacao de dependencia para a sonda de prontidao. Lanca quando a
 * dependencia nao responde.
 *
 * E uma funcao, e nao o PrismaClient, para que a camada HTTP nao passe a
 * conhecer o banco: trocar a tecnologia de persistencia nao deveria alcancar as
 * rotas de sonda.
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

  // Vivacidade nao consulta o banco de proposito. Falhar aqui reinicia o pod, e
  // reiniciar nao conserta um banco fora: o efeito seria um laco de reinicios
  // durante o incidente.
  router.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  // Prontidao consulta: um pod que nao alcanca o banco nao deve receber
  // trafego, e retirar do Service e exatamente o que o 503 faz.
  router.get('/ready', async (_req, res) => {
    try {
      await withTimeout(checkDatabase);
      res.status(200).json({ status: 'ready', checks: { database: 'up' } });
    } catch {
      res.status(503).json({ status: 'not-ready', checks: { database: 'down' } });
    }
  });

  // Sem autenticacao e sem rate limit: o Prometheus raspa de dentro do cluster,
  // sem credencial, e em intervalo fixo.
  router.get('/metrics', async (_req, res) => {
    res.set('Content-Type', registry.contentType);
    res.end(await registry.metrics());
  });

  return router;
}
