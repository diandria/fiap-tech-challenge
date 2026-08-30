import { Logger } from 'pino';
import { Customer } from '../../entities/Customer';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { INotificationService } from '../../use-cases/ports/INotificationService';
import { logger as defaultLogger } from '../../frameworks/logging/logger';

/**
 * Implementacao de desenvolvimento: registra a notificacao em vez de entrega-la.
 * A entrega real fica com a funcao serverless, acionada por evento (ADR-003).
 */
export class ConsoleNotificationService implements INotificationService {
  constructor(private readonly logger: Logger = defaultLogger) {}

  async notifyStatusChanged(customer: Customer, os: ServiceOrder): Promise<void> {
    this.logger.info(
      { event: 'status_changed', osId: os.id, status: os.status, customerEmail: customer.email },
      'notification dispatched',
    );
  }

  async notifyBudgetReady(customer: Customer, os: ServiceOrder): Promise<void> {
    this.logger.info(
      { event: 'budget_ready', osId: os.id, budgetTotal: os.budgetTotal, customerEmail: customer.email },
      'notification dispatched',
    );
  }
}
