import { SagaReply, SagaReplyResult } from '../../saga/messages';

/** Input port of the orchestrator: one reply from a participant at a time. */
export interface IServiceOrderSaga {
  handle(reply: SagaReply): Promise<SagaReplyResult>;
}
