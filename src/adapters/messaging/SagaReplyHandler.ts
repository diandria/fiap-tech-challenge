import { IMessageHandler } from '../../use-cases/ports/IMessageHandler';
import { IServiceOrderSaga } from '../../use-cases/ports/input/IServiceOrderSaga';
import { MessageEnvelope } from '../../use-cases/messaging/MessageEnvelope';
import { SAGA_REPLY_TYPES, SagaReplyType } from '../../use-cases/saga/messages';

function isSagaReplyType(type: string): type is SagaReplyType {
  return (SAGA_REPLY_TYPES as readonly string[]).includes(type);
}

/**
 * Turns an envelope from the saga replies queue into a typed reply for the
 * orchestrator. An unknown type throws: the message ends in the dead-letter
 * queue, which raises an alert, instead of being dropped.
 */
export class SagaReplyHandler implements IMessageHandler {
  constructor(private readonly saga: IServiceOrderSaga) {}

  async handle(envelope: MessageEnvelope): Promise<void> {
    if (!isSagaReplyType(envelope.type)) {
      throw new Error(`Unknown saga reply type ${envelope.type}`);
    }
    await this.saga.handle({
      messageId: envelope.messageId,
      type: envelope.type,
      serviceOrderId: envelope.serviceOrderId,
      payload: envelope.payload,
    });
  }
}
