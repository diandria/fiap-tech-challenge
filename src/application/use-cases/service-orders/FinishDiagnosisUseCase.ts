import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { IServiceRepository } from '../../../domain/ports/IServiceRepository';
import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { NotFoundError } from '../../../domain/errors/AppError';
import { assertTransition } from '../../../domain/serviceOrderStateMachine';

export class FinishDiagnosisUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly serviceRepo: IServiceRepository,
    private readonly itemRepo: IItemRepository,
  ) {}

  async execute(osId: string): Promise<ServiceOrder> {
    const os = await this.osRepo.findById(osId);
    if (!os) throw new NotFoundError('Service order');
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
    return updated!;
  }
}
