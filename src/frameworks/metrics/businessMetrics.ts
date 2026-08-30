import { Counter, Histogram } from '@prometheus-io/client';
import { registry } from './registry';

// Nomeadas pelo contexto delimitado (ordens de servico), nao pelo servico que
// hoje as expoe: quando isto virar mais de um servico, o nome continua valendo.
export const serviceOrdersCreated = new Counter({
  name: 'service_orders_created_total',
  help: 'Total de ordens de servico abertas',
  registers: [registry],
});

/**
 * Tempo entre a abertura da ordem e o momento em que ela atinge cada status.
 *
 * Nao e o tempo de permanencia em cada status: a entidade so grava timestamp
 * para EXECUTION, FINISHED e DELIVERED, entao DIAGNOSIS e WAITING_APPROVAL nao
 * teriam de onde derivar o inicio. O que da para medir com honestidade e o
 * tempo decorrido desde a abertura, que e o prazo de cada etapa visto pelo
 * cliente. Subtrair percentis de dois status vizinhos aproxima a permanencia.
 *
 * Buckets de 1 minuto a 1 dia: a escala de uma oficina, nao a de uma
 * requisicao HTTP.
 */
export const serviceOrderTimeToStatus = new Histogram({
  name: 'service_orders_time_to_status_seconds',
  help: 'Tempo desde a abertura da ordem de servico ate atingir cada status',
  labelNames: ['to_status'],
  buckets: [60, 300, 900, 3600, 14400, 86400],
  registers: [registry],
});
