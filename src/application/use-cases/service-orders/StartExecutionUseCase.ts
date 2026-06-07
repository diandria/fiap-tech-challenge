import { IServiceOrderRepository } from '../../../use-cases/ports/IServiceOrderRepository';
import { IItemRepository } from '../../../use-cases/ports/IItemRepository';
import { ServiceOrder } from '../../../entities/ServiceOrder';
import { NotFoundError, ValidationError } from '../../../entities/errors/AppError';
import { findOSOrThrow } from '../../utils/serviceOrderUtils';

export class StartExecutionUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly itemRepo: IItemRepository,
  ) {}

  async execute(osId: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    if (os.status !== 'APPROVED') throw new ValidationError('Service can only be started when OS is in APPROVED status');

    for (const i of os.items) {
      const item = await this.itemRepo.findById(i.itemId);
      if (!item) throw new NotFoundError('Item');
      await this.itemRepo.update(i.itemId, {
        stockQuantity: item.stockQuantity - i.quantity,
        reservedQuantity: item.reservedQuantity - i.quantity,
      });
    }

    const updated = await this.osRepo.update(osId, { status: 'EXECUTION', startedAt: new Date() });
    return updated!;
  }
}
