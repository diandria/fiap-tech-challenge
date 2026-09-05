import pino, { Logger, DestinationStream } from 'pino';
import { getTraceContext } from './context';

/**
 * Fields redacted from every event. The list is declared here, in one place,
 * because the alternative -- omitting at each call site -- depends on nobody
 * ever forgetting. The system logs requests carrying tax ids, the authorization
 * header and the internal endpoint's secret.
 */
const REDACTED_PATHS = [
  'cpf',
  'taxId',
  'password',
  'passwordHash',
  'req.headers.authorization',
  'req.headers["x-internal-token"]',
  'headers.authorization',
  'headers["x-internal-token"]',
];

export interface LoggerOptions {
  /** Injectable for tests: without this seam, checking redaction would mean capturing process output. */
  stream?: DestinationStream;
}

export function buildLogger(opts: LoggerOptions = {}): Logger {
  const prettyInDevelopment =
    process.env.NODE_ENV !== 'production' && !opts.stream
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {};

  return pino(
    {
      level: process.env.LOG_LEVEL ?? 'info',
      // Open semantic conventions (ADR-007): comparable telemetry across
      // services without a private agreement.
      base: {
        'service.name': process.env.OTEL_SERVICE_NAME ?? 'car-repair-shop-api',
        'service.version': process.env.SERVICE_VERSION ?? '0.0.0',
        'deployment.environment': process.env.NODE_ENV ?? 'development',
      },
      redact: { paths: REDACTED_PATHS, censor: '[Redacted]' },
      // The mixin means no log call has to remember the trace.
      mixin() {
        const ctx = getTraceContext();
        return ctx ? { trace_id: ctx.traceId, span_id: ctx.spanId } : {};
      },
      ...prettyInDevelopment,
    },
    opts.stream,
  );
}

export const logger = buildLogger();
