import pino, { Logger, DestinationStream } from 'pino';
import { getTraceContext } from './context';

/**
 * Campos ocultados em todo evento. A lista fica declarada aqui, num lugar so,
 * porque a alternativa (omitir em cada chamada) depende de ninguem esquecer.
 * O sistema registra requisicoes que carregam CPF, cabecalho de autorizacao e o
 * segredo do endpoint interno.
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
  /** Injetavel para teste: sem essa costura, verificar ocultacao exigiria capturar a saida do processo. */
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
      // Convencoes semanticas abertas (ADR-007): um servico novo, em qualquer
      // linguagem, emite telemetria comparavel sem combinar nada.
      base: {
        'service.name': process.env.OTEL_SERVICE_NAME ?? 'car-repair-shop-api',
        'service.version': process.env.SERVICE_VERSION ?? '0.0.0',
        'deployment.environment': process.env.NODE_ENV ?? 'development',
      },
      redact: { paths: REDACTED_PATHS, censor: '[Redacted]' },
      // Com o mixin, nenhum ponto de registro precisa lembrar de incluir o rastro,
      // o que significa que nenhum vai esquecer.
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
