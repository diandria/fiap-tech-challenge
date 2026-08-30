import { Counter } from '@prometheus-io/client';
import { registry } from './registry';

/**
 * Falhas em integracoes externas, separadas por integracao e operacao.
 *
 * E o gatilho do alerta de falhas no processamento de ordens de servico: as
 * notificacoes sao best-effort e os casos de uso engolem o erro de proposito,
 * porque notificacao nao pode reverter transicao de status. Sem este contador,
 * uma integracao quebrada fica invisivel ate alguem reclamar.
 */
export const integrationFailures = new Counter({
  name: 'integration_failures_total',
  help: 'Falhas em integracoes externas',
  labelNames: ['integration', 'operation'],
  registers: [registry],
});
