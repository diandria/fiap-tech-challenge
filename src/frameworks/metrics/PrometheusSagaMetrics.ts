import { ISagaMetrics } from '../../use-cases/ports/ISagaMetrics';
import { CompensationReason, SagaReplyOutcome } from '../../use-cases/saga/messages';
import { sagaCompensations, sagaReplies, sagaStuck } from './sagaMetrics';

/** Prometheus-backed implementation of the saga metrics port. */
export class PrometheusSagaMetrics implements ISagaMetrics {
  replyHandled(type: string, outcome: SagaReplyOutcome): void {
    sagaReplies.inc({ type, outcome });
  }

  compensated(reason: CompensationReason): void {
    sagaCompensations.inc({ reason });
  }

  stepStuck(commandType: string): void {
    sagaStuck.inc({ command: commandType });
  }
}
