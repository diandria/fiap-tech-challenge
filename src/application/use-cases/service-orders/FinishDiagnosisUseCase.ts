import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { IServiceRepository } from '../../../domain/ports/IServiceRepository';
import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { INotificationService } from '../../../domain/ports/INotificationService';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { assertTransition } from '../../../domain/serviceOrderStateMachine';
import { findOSOrThrow } from '../../utils/serviceOrderUtils';

export class FinishDiagnosisUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly serviceRepo: IServiceRepository,
    private readonly itemRepo: IItemRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly notifier: INotificationService,
  ) {}

  async execute(osId: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    assertTransition(os.status, 'WAITING_APPROVAL');

    let total = 0;

    for (const s of os.services) {
      const service = await this.serviceRepo.findById(s.serviceId);
      if (service) total += service.price;
    }

    for (const i of os.items) {
      const item = await this.itemRepo.findById(i.itemId);
      if (item) total += item.price * i.quantity;
    }

    const updated = await this.osRepo.update(osId, {
      status: 'WAITING_APPROVAL',
      budgetTotal: total,
    });

    const customer = await this.customerRepo.findById(updated!.customerId);
    if (!customer) {
      console.warn(`[NOTIFICATION] Customer not found for OS ${osId}`);
    } else {
      try {
        await this.notifier.notifyBudgetReady(customer, updated!);
      } catch (err) {
        console.error(`[NOTIFICATION] Failed to notify customer for OS ${osId}`, err);
      }
    }

    return updated!;
  }
}
