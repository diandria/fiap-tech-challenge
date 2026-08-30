import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'node:crypto';
import { runWithTraceContext, toTraceparent, TraceContext } from '../../logging/context';

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;

/**
 * A correlacao primaria e o cabecalho padronizado, nao um identificador proprio
 * (ADR-007). Um identificador caseiro funciona dentro de um processo e morre na
 * primeira fronteira de servico, porque nenhuma biblioteca o propaga sozinha.
 *
 * Nota de sequencia: o parsing e feito a mao aqui porque o SDK de instrumentacao
 * so entra no M3. O formato na rede e o mesmo, entao a troca pelo propagador
 * oficial nao quebra nada em execucao.
 */
export function traceContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = TRACEPARENT.exec(String(req.headers.traceparent ?? ''));
  const businessId = req.headers['x-correlation-id'];

  const ctx: TraceContext = {
    traceId: incoming ? incoming[1] : randomBytes(16).toString('hex'),
    spanId: randomBytes(8).toString('hex'),
    ...(businessId ? { correlationId: String(businessId) } : {}),
  };

  res.setHeader('traceparent', toTraceparent(ctx));
  runWithTraceContext(ctx, () => next());
}
