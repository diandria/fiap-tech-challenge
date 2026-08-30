import { Request, Response, NextFunction } from 'express';
import { Logger } from 'pino';
import { AppError } from '../../../entities/errors/AppError';
import { logger as defaultLogger } from '../../logging/logger';

/**
 * Erro operacional esperado (4xx) e aviso; erro inesperado e erro, com pilha.
 * Sem essa distincao, todo "nao encontrado" vira alerta e o sinal se perde.
 */
export function buildErrorMiddleware(log: Logger = defaultLogger) {
  return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    const where = { method: req.method, route: req.route?.path ?? req.path };

    if (err instanceof AppError) {
      log.warn({ ...where, statusCode: err.statusCode, err: err.message }, 'request rejected');
      res.status(err.statusCode).json({ error: err.message });
      return;
    }

    log.error({ ...where, err, stack: err.stack }, 'unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  };
}

export const errorMiddleware = buildErrorMiddleware();
