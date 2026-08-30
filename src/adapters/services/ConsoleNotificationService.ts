import { Logger } from 'pino';
import { Customer } from '../../entities/Customer';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { INotificationService } from '../../use-cases/ports/INotificationService';
import { logger as defaultLogger } from '../../frameworks/logging/logger';
import { integrationFailures } from '../../frameworks/metrics/integrationMetrics';

const INTEGRATION = 'notification';

/**
 * Implementacao de desenvolvimento: registra a notificacao em vez de entrega-la.
 * A entrega real fica com a funcao serverless, acionada por evento (ADR-003).
 */
export class ConsoleNotificationService implements INotificationService {
  constructor(private readonly logger: Logger = defaultLogger) {}

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
   * Conta a falha e relanca.
   *
   * Relancar mantem o comportamento intacto: o erro continua chegando ao catch
   * do caso de uso, que segue nao revertendo a transicao de status. Engolir
   * aqui mudaria a semantica para ganhar nada.
   */
  private async dispatch(operation: string, send: () => void): Promise<void> {
    try {
      send();
    } catch (err) {
      integrationFailures.inc({ integration: INTEGRATION, operation });
      throw err;
    }
  }
}
