import { Counter } from '@prometheus-io/client';
import { registry } from './registry';
import { COMPENSATION_REASONS, SAGA_COMMAND_TYPES, SAGA_REPLY_OUTCOMES, SAGA_REPLY_TYPES } from '../../use-cases/saga/messages';

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

// A labelled series only exists after its first increment, and increase()
// cannot see the step from "absent" to 1: the first compensation of each
// reason would read as zero on the dashboard and never fire an alert.
// Starting every known series at zero makes that first event count.
for (const type of SAGA_REPLY_TYPES) {
  for (const outcome of SAGA_REPLY_OUTCOMES) sagaReplies.inc({ type, outcome }, 0);
}
for (const reason of COMPENSATION_REASONS) sagaCompensations.inc({ reason }, 0);
for (const command of SAGA_COMMAND_TYPES) sagaStuck.inc({ command }, 0);
