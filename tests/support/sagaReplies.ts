import { randomUUID } from 'node:crypto';
import { SagaReply, SagaReplyType } from '../../src/use-cases/saga/messages';

/** A saga reply as the consumer hands it to the orchestrator, with a fresh message id. */
export function sagaReply(type: SagaReplyType, serviceOrderId: string, payload: Record<string, unknown> = {}): SagaReply {
  return { messageId: randomUUID(), type, serviceOrderId, payload };
}
