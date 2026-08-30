import request from 'supertest';
import express, { Router } from 'express';
import { registry } from '../../../../src/frameworks/metrics/registry';
import { requestLoggerMiddleware } from '../../../../src/frameworks/http/middlewares/requestLoggerMiddleware';
import { traceContextMiddleware } from '../../../../src/frameworks/http/middlewares/traceContextMiddleware';

function appWith(mount: (app: express.Application) => void): express.Application {
  const app = express();
  app.use(traceContextMiddleware);
  app.use(requestLoggerMiddleware());
  mount(app);
  return app;
}

/**
 * Extrai os valores do rotulo route do formato de exposicao.
 *
 * Buscar o caminho concreto como substring solta no texto inteiro seria fragil:
 * os valores acumulados do histograma sao floats, e uma sequencia de digitos
 * como 9999 aparece dentro de um _sum sem que exista serie alguma com aquele
 * caminho.
 */
async function routeLabels(): Promise<string[]> {
  const text = await registry.metrics();
  return [...text.matchAll(/route="([^"]*)"/g)].map((m) => m[1]);
}

describe('http latency histogram', () => {
  it('should record the route template GIVEN a parametrized route WHEN a request completes', async () => {
    const app = appWith((a) => a.get('/service-orders/:id', (_req, res) => res.status(200).json({})));

    await request(app).get('/service-orders/abc-123');

    const routes = await routeLabels();
    expect(routes).toContain('/service-orders/:id');
    // Protege a cardinalidade: sem esta asercao, a regressao so aparece quando o
    // Prometheus ja estiver com milhares de series.
    expect(routes).not.toContain('/service-orders/abc-123');
  });

  it('should label the status code GIVEN a 404 WHEN a request completes', async () => {
    const app = appWith((a) => a.get('/x', (_req, res) => res.status(404).json({})));

    await request(app).get('/x');

    expect(await registry.metrics()).toContain('status_code="404"');
  });

  it('should keep the mount prefix GIVEN a router mounted under a path WHEN a request completes', async () => {
    // Os routers do projeto sao montados com prefixo e declaram '/:id' dentro.
    // Sem o prefixo, /customers/:id e /service-orders/:id virariam o mesmo
    // rotulo e os paineis somariam endpoints diferentes na mesma serie.
    const customers = Router();
    customers.get('/:id', (_req, res) => res.status(200).json({}));
    const app = appWith((a) => a.use('/customers', customers));

    await request(app).get('/customers/11111111-1111-1111-1111-111111111111');

    expect(await routeLabels()).toContain('/customers/:id');
  });

  it('should collapse unmatched paths into a single series GIVEN no route matches WHEN a request completes', async () => {
    // Caminho sem rota nao tem template. Usar o caminho concreto aqui deixaria
    // qualquer varredura de URL criar uma serie temporal nova por requisicao.
    const app = appWith((a) => a.get('/known', (_req, res) => res.status(200).json({})));

    await request(app).get('/no-such-route/9999');

    const routes = await routeLabels();
    expect(routes).toContain('unmatched');
    expect(routes).not.toContain('/no-such-route/9999');
  });
});
