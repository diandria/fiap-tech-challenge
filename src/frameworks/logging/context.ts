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
