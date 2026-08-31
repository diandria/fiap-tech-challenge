import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'node:crypto';
import { context, trace, isSpanContextValid } from '@opentelemetry/api';
import { runWithTraceContext, toTraceparent, TraceContext } from '../../logging/context';

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/;

/**
 * Identifiers of the span the SDK already opened for this request, when there
 * is one.
 *
 * OpenTelemetry's auto-instrumentation creates the span before any application
 * middleware runs. Adopting its identifiers is what makes the log and the trace
 * point at the same thing: minting our own here would produce two valid
 * identifiers that never meet, which is worse than having no correlation at
 * all, because it looks like it works.
 */
function activeSpanIds(): { traceId: string; spanId: string } | undefined {
  const spanContext = trace.getSpan(context.active())?.spanContext();
  if (!spanContext || !isSpanContextValid(spanContext)) return undefined;
  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
}

/**
 * The primary correlation is the standard header, not a home-grown identifier
 * (ADR-007). A custom identifier works inside one process and dies at the first
 * service boundary, because no library propagates it on its own.
 *
 * With no collector configured the SDK does not start, and then minting our own
 * still applies: local development and the test suite need no collector.
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
