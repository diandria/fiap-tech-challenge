import { Customer } from '../../entities/Customer';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { INotificationService } from '../../use-cases/ports/INotificationService';

export class ConsoleNotificationService implements INotificationService {
  async notifyStatusChanged(customer: Customer, os: ServiceOrder): Promise<void> {
    console.log(
      `[Status] OS ${os.id} → ${os.status} | cliente: ${customer.name} (${customer.email})`,
    );
  }

  async notifyBudgetReady(customer: Customer, os: ServiceOrder): Promise<void> {
    console.log(
      `[Budget] OS ${os.id} | orçamento: R$ ${os.budgetTotal?.toFixed(2)} | cliente: ${customer.name} (${customer.email})`,
    );
  }
}
