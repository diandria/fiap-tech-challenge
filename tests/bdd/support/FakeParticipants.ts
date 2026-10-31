import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { IServiceOrderSaga } from '../../../src/use-cases/ports/input/IServiceOrderSaga';
import { IMessageHandler } from '../../../src/use-cases/ports/IMessageHandler';
import { MessageEnvelope } from '../../../src/use-cases/messaging/MessageEnvelope';
import { SagaReplyType } from '../../../src/use-cases/saga/messages';

interface StoredCommand {
  messageId: string;
  type: string;
  payload: Record<string, unknown>;
}

/**
 * Plays the Billing and Execution services by the ADR-015 contract: it reads
 * the commands the OS Service wrote to its outbox and hands the orchestrator
 * the reply the real participant would send. Nothing is written straight to
 * the order; every change goes through a message.
 */
export class FakeParticipants {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly saga: IServiceOrderSaga,
    private readonly deadLetters: IMessageHandler,
  ) {}

  /** The commands the OS sent for an order, oldest first, optionally of one type. */
  async commandsFor(serviceOrderId: string, type?: string): Promise<StoredCommand[]> {
    const rows = await this.prisma.outboxMessage.findMany({
      where: { serviceOrderId, ...(type && { type }) },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({ messageId: row.id, type: row.type, payload: row.payload as Record<string, unknown> }));
  }

  /** The mechanic starts and finishes the diagnosis in the Execution Service. */
  async diagnose(serviceOrderId: string): Promise<void> {
    await this.reply(serviceOrderId, 'DiagnosisStarted');
    await this.reply(serviceOrderId, 'DiagnosisCompleted');
  }

  /** The Billing Service turns the GenerateBudget it received into a budget. */
  async generateBudget(serviceOrderId: string): Promise<void> {
    const command = await this.lastCommand(serviceOrderId, 'GenerateBudget');
    const lines = command.payload.lines as { unitPrice: number; quantity: number }[];
    const total = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    await this.reply(serviceOrderId, 'BudgetGenerated', { budgetId: randomUUID(), total });
  }

  /** The Billing Service records the customer's decision. */
  async customerDecides(serviceOrderId: string, decision: 'BudgetApproved' | 'BudgetRejected'): Promise<void> {
    await this.reply(serviceOrderId, decision, { budgetId: randomUUID() });
  }

  /** The Billing Service charged the budget after the RequestPayment, and the provider refused it. */
  async refusePayment(serviceOrderId: string): Promise<void> {
    await this.lastCommand(serviceOrderId, 'RequestPayment');
    await this.reply(serviceOrderId, 'PaymentFailed', { paymentId: randomUUID(), reason: 'cc_rejected_other_reason' });
  }

  /** The participant failed the command five times, and the queue moved it to the dead-letter queue. */
  async exhaustRetries(serviceOrderId: string, type: string): Promise<void> {
    const command = await this.lastCommand(serviceOrderId, type);
    const envelope: MessageEnvelope = {
      messageId: command.messageId,
      type: command.type,
      serviceOrderId,
      occurredAt: new Date().toISOString(),
      payload: command.payload,
    };
    await this.deadLetters.handle(envelope);
  }

  private async reply(serviceOrderId: string, type: SagaReplyType, payload: Record<string, unknown> = {}): Promise<void> {
    await this.saga.handle({ messageId: randomUUID(), type, serviceOrderId, payload });
  }

  private async lastCommand(serviceOrderId: string, type: string): Promise<StoredCommand> {
    const commands = await this.commandsFor(serviceOrderId, type);
    const last = commands.at(-1);
    if (!last) throw new Error(`The OS never sent ${type} for order ${serviceOrderId}`);
    return last;
  }
}
