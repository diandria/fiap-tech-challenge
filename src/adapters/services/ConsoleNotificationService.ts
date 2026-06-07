import { Customer } from '../../entities/Customer';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { INotificationService } from '../../use-cases/ports/INotificationService';

export class ConsoleNotificationService implements INotificationService {
  async notifyBudgetReady(customer: Customer, os: ServiceOrder): Promise<void> {
    const subject = `Orçamento da OS ${os.id} pronto para aprovação`;
    const body = `Olá ${customer.name}, o orçamento da sua OS ${os.id} está disponível: R$ ${os.budgetTotal}.`;
    console.log(
      `[NOTIFICATION] Email sent to ${customer.email}\n  subject: "${subject}"\n  body: ${body}`,
    );
    return Promise.resolve();
  }
}
