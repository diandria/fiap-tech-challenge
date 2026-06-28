import { Customer } from '../../entities/Customer';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { INotificationService } from '../../use-cases/ports/INotificationService';

export class ConsoleNotificationService implements INotificationService {
  async notifyStatusChanged(customer: Customer, os: ServiceOrder): Promise<void> {
    console.log(
      `[Status] OS ${os.id} → ${os.status} | customer: ${customer.name} (${customer.email})`,
    );
  }

  async notifyBudgetReady(customer: Customer, os: ServiceOrder): Promise<void> {
    console.log(
      `[Budget] OS ${os.id} | amount: R$ ${os.budgetTotal?.toFixed(2)} | customer: ${customer.name} (${customer.email})`,
    );
  }
}
