import { Counter } from '@prometheus-io/client';
import { registry } from './registry';

export const sagaReplies = new Counter({
  name: 'saga_replies_total',
  help: 'Saga replies handled by the orchestrator, by type and outcome',
  labelNames: ['type', 'outcome'],
  registers: [registry],
});

export const sagaCompensations = new Counter({
  name: 'saga_compensations_total',
  help: 'Saga compensations started, by reason',
  labelNames: ['reason'],
  registers: [registry],
});

/** Backs the alert on a saga that needs a person: a dead command past the point of no return. */
export const sagaStuck = new Counter({
  name: 'saga_stuck_total',
  help: 'Dead saga commands that could not be compensated, by command',
  labelNames: ['command'],
  registers: [registry],
});
