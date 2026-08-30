import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'node:crypto';
import { context, trace, isSpanContextValid } from '@opentelemetry/api';
import { runWithTraceContext, toTraceparent, TraceContext } from '../../logging/context';

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;

/**
 * Identificadores do span que o SDK ja abriu para esta requisicao, quando ha um.
 *
 * A auto-instrumentacao do OpenTelemetry cria o span antes de qualquer
 * middleware da aplicacao rodar. Adotar os identificadores dele e o que faz o
 * registro e o trace apontarem para a mesma coisa: gerar os proprios aqui
 * produziria dois identificadores validos que nunca se encontram, o que e pior
 * que nao ter correlacao, porque parece funcionar.
 */
function activeSpanIds(): { traceId: string; spanId: string } | undefined {
  const spanContext = trace.getSpan(context.active())?.spanContext();
  if (!spanContext || !isSpanContextValid(spanContext)) return undefined;
  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
}

/**
 * A correlacao primaria e o cabecalho padronizado, nao um identificador proprio
 * (ADR-007). Um identificador caseiro funciona dentro de um processo e morre na
 * primeira fronteira de servico, porque nenhuma biblioteca o propaga sozinha.
 *
 * Sem coletor configurado o SDK nao sobe, e ai a geracao propria continua
 * valendo: desenvolvimento local e a suite de testes nao precisam de um.
 */
export function traceContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const active = activeSpanIds();
  const incoming = TRACEPARENT.exec(String(req.headers.traceparent ?? ''));
  const businessId = req.headers['x-correlation-id'];

  const ctx: TraceContext = {
    traceId: active?.traceId ?? (incoming ? incoming[1] : randomBytes(16).toString('hex')),
    spanId: active?.spanId ?? randomBytes(8).toString('hex'),
    ...(businessId ? { correlationId: String(businessId) } : {}),
  };

  res.setHeader('traceparent', toTraceparent(ctx));
  runWithTraceContext(ctx, () => next());
}
