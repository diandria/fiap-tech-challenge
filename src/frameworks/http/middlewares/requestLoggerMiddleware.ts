import { Request, Response, NextFunction } from 'express';
import { Logger } from 'pino';
import { logger as defaultLogger } from '../../logging/logger';
import { getTraceContext } from '../../logging/context';
import { httpRequestDuration } from '../../metrics/httpMetrics';

/**
 * Sondas e raspagem de metricas sao chamadas a cada poucos segundos. Em nivel
 * informativo, afogariam o registro util.
 */
const QUIET_PATHS = new Set(['/health', '/ready', '/metrics']);

/**
 * Template da rota, com o prefixo de montagem.
 *
 * `req.route.path` traz apenas o trecho declarado dentro do router: os routers
 * do projeto sao montados com prefixo e declaram '/:id' dentro, entao sem
 * `req.baseUrl` os endpoints de clientes e de ordens de servico virariam o mesmo
 * rotulo. Devolve undefined quando nenhuma rota casou, porque ai nao existe
 * template.
 */
function routeTemplate(req: Request): string | undefined {
  if (!req.route) return undefined;
  const path = req.route.path === '/' ? '' : req.route.path;
  return `${req.baseUrl}${path}` || '/';
}

export function requestLoggerMiddleware(log: Logger = defaultLogger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const ctx = getTraceContext();
      const template = routeTemplate(req);
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

      const event = {
        method: req.method,
        // No registro, o caminho concreto de uma rota nao encontrada e a
        // informacao util: diz o que o cliente tentou chamar.
        route: template ?? req.path,
        statusCode: res.statusCode,
        durationMs,
        ...(ctx ? { trace_id: ctx.traceId, span_id: ctx.spanId } : {}),
        ...(ctx?.correlationId ? { correlationId: ctx.correlationId } : {}),
      };

      // Na metrica, nao: cada caminho concreto viraria uma serie temporal, e uma
      // varredura de URLs bastaria para inflar o Prometheus.
      httpRequestDuration.observe(
        { method: req.method, route: template ?? 'unmatched', status_code: res.statusCode },
        durationMs / 1000,
      );

      if (QUIET_PATHS.has(req.path)) log.debug(event);
      else log.info(event);
    });

    next();
  };
}
