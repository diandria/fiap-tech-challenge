import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { ICustomerRepository } from '../ports/ICustomerRepository';
import { INotificationService } from '../ports/INotificationService';
import { ILogger } from '../ports/ILogger';
import { IStatusChangeNotifier } from '../ports/IStatusChangeNotifier';

export class NotifyStatusChangeUseCase implements IStatusChangeNotifier {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly notifier: INotificationService,
    private readonly logger: ILogger,
  ) {}

  async execute({ osId }: { osId: string }): Promise<void> {
    try {
      const os = await this.osRepo.findById(osId);
      if (!os) return;
      const customer = await this.customerRepo.findById(os.customerId);
      if (!customer) {
        this.logger.warn('notification skipped: customer not found', { osId });
        return;
      }
      await this.notifier.notifyStatusChanged(customer, os);
    } catch (err) {
      // Silent failure by decision: a notification does not roll back a status
      // transition. The log makes the failure visible without changing that.
      this.logger.error('notification delivery failed', { osId, err });
    }
  }
}
