import { Request, Response, NextFunction } from 'express';
import { Logger } from 'pino';
import { logger as defaultLogger } from '../../logging/logger';
import { getTraceContext } from '../../logging/context';

/**
 * Sondas e raspagem de metricas sao chamadas a cada poucos segundos. Em nivel
 * informativo, afogariam o registro util.
 */
const QUIET_PATHS = new Set(['/health', '/ready', '/metrics']);

export function requestLoggerMiddleware(log: Logger = defaultLogger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const ctx = getTraceContext();

      const event = {
        method: req.method,
        // Sempre o template da rota, nunca o valor concreto: com o valor, cada
        // identificador criaria uma serie temporal e uma stream de registro novas.
        route: req.route?.path ?? req.path,
        statusCode: res.statusCode,
        durationMs: Number(process.hrtime.bigint() - start) / 1_000_000,
        ...(ctx ? { trace_id: ctx.traceId, span_id: ctx.spanId } : {}),
        ...(ctx?.correlationId ? { correlationId: ctx.correlationId } : {}),
      };

      if (QUIET_PATHS.has(req.path)) log.debug(event);
      else log.info(event);
    });

    next();
  };
}
