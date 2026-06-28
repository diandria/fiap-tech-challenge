import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { ICustomerRepository } from '../ports/ICustomerRepository';
import { INotificationService } from '../ports/INotificationService';
import { IBudgetNotifier } from '../ports/IBudgetNotifier';

export class NotifyBudgetUseCase implements IBudgetNotifier {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly notifier: INotificationService,
  ) {}

  async execute({ osId }: { osId: string }): Promise<void> {
    try {
      const os = await this.osRepo.findById(osId);
      if (!os) return;
      const customer = await this.customerRepo.findById(os.customerId);
      if (!customer) {
        console.warn(`[NOTIFICATION] Customer not found for OS ${osId}`);
        return;
      }
      await this.notifier.notifyBudgetReady(customer, os);
    } catch (err) {
      console.error(`[NOTIFICATION] Failed to notify customer for OS ${osId}`, err);
    }
  }
}
