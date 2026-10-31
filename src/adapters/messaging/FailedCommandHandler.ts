import { IMessageHandler } from '../../use-cases/ports/IMessageHandler';
import { IServiceOrderSaga } from '../../use-cases/ports/input/IServiceOrderSaga';
import { MessageEnvelope } from '../../use-cases/messaging/MessageEnvelope';
import { SAGA_COMMAND_TYPES, SagaCommandType } from '../../use-cases/saga/messages';

function isSagaCommandType(type: string): type is SagaCommandType {
  return (SAGA_COMMAND_TYPES as readonly string[]).includes(type);
}

/**
 * Reads a command dead-letter queue. What lands there is a command the
 * participant received five times and could not process, so the saga treats
 * it as a failed step. Anything that is not one of the OS commands throws and
 * stays on the queue.
 */
export class FailedCommandHandler implements IMessageHandler {
  constructor(private readonly saga: IServiceOrderSaga) {}

  async handle(envelope: MessageEnvelope): Promise<void> {
    if (!isSagaCommandType(envelope.type)) {
      throw new Error(`Unknown saga command type ${envelope.type}`);
    }
    await this.saga.handleFailedCommand({
      messageId: envelope.messageId,
      type: envelope.type,
      serviceOrderId: envelope.serviceOrderId,
    });
  }
}
