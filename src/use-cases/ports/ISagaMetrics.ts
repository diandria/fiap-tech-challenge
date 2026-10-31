import { CompensationReason, SagaReplyOutcome } from '../saga/messages';

/** Output port for the saga metrics, so the decorator does not import counters from the outermost layer. */
export interface ISagaMetrics {
  replyHandled(type: string, outcome: SagaReplyOutcome): void;
  compensated(reason: CompensationReason): void;
  /** A dead command that can no longer be compensated and needs a person. */
  stepStuck(commandType: string): void;
}
