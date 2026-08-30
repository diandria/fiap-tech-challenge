import { AsyncLocalStorage } from 'node:async_hooks';

export interface TraceContext {
  /** Identificador do rastro, propagado entre servicos pelo cabecalho padronizado. */
  traceId: string;
  /** Identificador desta unidade de trabalho dentro do rastro. */
  spanId: string;
  /**
   * Identificador de negocio, opcional e distinto do rastro. Serve para amarrar
   * uma requisicao a um protocolo de atendimento, nao para correlacionar servicos.
   */
  correlationId?: string;
}

const storage = new AsyncLocalStorage<TraceContext>();

export function runWithTraceContext<T>(ctx: TraceContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getTraceContext(): TraceContext | undefined {
  return storage.getStore();
}

export function toTraceparent(ctx: TraceContext): string {
  return `00-${ctx.traceId}-${ctx.spanId}-01`;
}

/**
 * Cabecalhos a injetar em toda chamada que sai da aplicacao: consulta de cliente
 * pela funcao de autenticacao, publicacao de evento, e chamadas entre servicos
 * quando existirem.
 *
 * Sem isso o rastro termina na fronteira do processo, que e justamente onde ele
 * passa a valer mais.
 */
export function outboundTraceHeaders(): Record<string, string> {
  const ctx = getTraceContext();
  return ctx ? { traceparent: toTraceparent(ctx) } : {};
}
