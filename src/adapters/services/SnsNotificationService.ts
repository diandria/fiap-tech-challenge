import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { Customer } from '../../entities/Customer';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { INotificationService } from '../../use-cases/ports/INotificationService';
import { IIntegrationFailures } from '../../use-cases/ports/IIntegrationFailures';
import { ITraceContext } from '../../use-cases/ports/ITraceContext';

const INTEGRATION = 'sns';

type EventType = 'SERVICE_ORDER_STATUS_CHANGED' | 'BUDGET_READY';

/**
 * Notification delivery by publishing an event to an SNS topic.
 *
 * It is the second implementation of a port that has existed since Phase 2:
 * swapping `console.log` for a publish opened no use case. The choice between
 * this and ConsoleNotificationService happens in the Composition Root, driven
 * by NOTIFICATION_CHANNEL.
 *
 * The payload shape is the ADR-003 contract, implemented separately by the
 * function that consumes the topic as well. The two repositories share no code
 * on purpose; the coupling is the written contract.
 */
export class SnsNotificationService implements INotificationService {
  constructor(
    private readonly sns: SNSClient,
    private readonly topicArn: string,
    private readonly failures: IIntegrationFailures,
    private readonly traceContext: ITraceContext,
  ) {}

  async notifyStatusChanged(customer: Customer, os: ServiceOrder): Promise<void> {
    await this.publish('SERVICE_ORDER_STATUS_CHANGED', 'status_changed', customer, os);
  }

  async notifyBudgetReady(customer: Customer, os: ServiceOrder): Promise<void> {
    await this.publish('BUDGET_READY', 'budget_ready', customer, os);
  }

  private buildPayload(eventType: EventType, customer: Customer, os: ServiceOrder): string {
    const traceparent = this.traceContext.currentTraceparent();

    return JSON.stringify({
      eventType,
      occurredAt: new Date().toISOString(),

      // Omitted when there is no active trace: an invalid traceparent would
      // correlate unrelated events in the consumer.
      ...(traceparent && { traceparent }),

      serviceOrder: {
        id: os.id,
        status: os.status,
        ...(os.budgetTotal !== undefined && { budgetTotal: os.budgetTotal }),
      },

      // Only the fields the consumer uses; tax id and phone are not published.
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
      },
    });
  }

  /**
   * Counts the failure and rethrows, in the same pattern as
   * ConsoleNotificationService: the error still reaches the use case's catch,
   * which does not roll back the status transition. Swallowing it here would
   * change the semantics and gain nothing.
   */
  private async publish(
    eventType: EventType,
    operation: string,
    customer: Customer,
    os: ServiceOrder,
  ): Promise<void> {
    try {
      await this.sns.send(
        new PublishCommand({
          TopicArn: this.topicArn,
          Message: this.buildPayload(eventType, customer, os),
        }),
      );
    } catch (err) {
      this.failures.record(INTEGRATION, operation);
      throw err;
    }
  }
}
