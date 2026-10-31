import { FailedSagaCommand, SagaReply, SagaReplyResult } from '../../saga/messages';

/** Input port of the orchestrator: one reply from a participant at a time. */
export interface IServiceOrderSaga {
  handle(reply: SagaReply): Promise<SagaReplyResult>;
  /** A command that exhausted its retries at the participant: the step failed. */
  handleFailedCommand(command: FailedSagaCommand): Promise<SagaReplyResult>;
}
