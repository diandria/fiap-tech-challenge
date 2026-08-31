import { Customer } from '../../entities/Customer';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { INotificationService } from '../../use-cases/ports/INotificationService';
import { IIntegrationFailures } from '../../use-cases/ports/IIntegrationFailures';

/**
 * The subset of a logger this adapter needs.
 *
 * `ILogger` deliberately carries only `warn` and `error`, which is what the
 * inner layers use. Widening it to satisfy this adapter would hand use cases a
 * method they never call.
 */
export interface INotificationLogger {
  info(context: Record<string, unknown>, message: string): void;
}

const INTEGRATION = 'notification';

/**
 * Development implementation: records the notification instead of delivering
 * it. Real delivery belongs to the serverless function, triggered by an event
 * (ADR-003).
 */
export class ConsoleNotificationService implements INotificationService {
  constructor(
    private readonly logger: INotificationLogger,
    private readonly failures: IIntegrationFailures,
  ) {}

  async notifyStatusChanged(customer: Customer, os: ServiceOrder): Promise<void> {
    await this.dispatch('status_changed', () => {
      this.logger.info(
        { event: 'status_changed', osId: os.id, status: os.status, customerEmail: customer.email },
        'notification dispatched',
      );
    });
  }

  async notifyBudgetReady(customer: Customer, os: ServiceOrder): Promise<void> {
    await this.dispatch('budget_ready', () => {
      this.logger.info(
        { event: 'budget_ready', osId: os.id, budgetTotal: os.budgetTotal, customerEmail: customer.email },
        'notification dispatched',
      );
    });
  }

  /**
   * Counts the failure and rethrows.
   *
   * Rethrowing keeps the behaviour intact: the error still reaches the use
   * case's catch, which goes on not rolling back the status transition.
   * Swallowing it here would change the semantics and gain nothing.
   */
  private async dispatch(operation: string, send: () => void): Promise<void> {
    try {
      send();
    } catch (err) {
      this.failures.record(INTEGRATION, operation);
      throw err;
    }
  }
}
