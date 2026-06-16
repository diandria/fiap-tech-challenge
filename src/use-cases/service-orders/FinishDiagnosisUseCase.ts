import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { IServiceRepository } from '../ports/IServiceRepository';
import { IItemRepository } from '../ports/IItemRepository';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { assertTransition } from '../../entities/serviceOrderStateMachine';
import { findOSOrThrow } from '../utils/serviceOrderUtils';
import { NotifyStatusChangeUseCase } from './NotifyStatusChangeUseCase';
import { NotifyBudgetUseCase } from './NotifyBudgetUseCase';

export class FinishDiagnosisUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly serviceRepo: IServiceRepository,
    private readonly itemRepo: IItemRepository,
    private readonly notifyStatusChange: NotifyStatusChangeUseCase,
    private readonly notifyBudget: NotifyBudgetUseCase,
  ) {}

  async execute(osId: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    assertTransition(os.status, 'WAITING_APPROVAL');

    let total = 0;

    for (const osService of os.services) {
      const service = await this.serviceRepo.findById(osService.serviceId);
      if (service) total += service.price;
    }

    for (const osItem of os.items) {
      const item = await this.itemRepo.findById(osItem.itemId);
      if (item) total += item.price * osItem.quantity;
    }

    const updated = await this.osRepo.update(osId, {
      status: 'WAITING_APPROVAL',
      budgetTotal: total,
    });

    await this.notifyStatusChange.execute({ osId });
    await this.notifyBudget.execute({ osId });

    return updated!;
  }
}
