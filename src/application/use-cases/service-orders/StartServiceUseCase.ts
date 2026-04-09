import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { NotFoundError, ValidationError } from '../../../domain/errors/AppError';

export class StartServiceUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly itemRepo: IItemRepository,
  ) {}

  async execute(osId: string): Promise<ServiceOrder> {
    const os = await this.osRepo.findById(osId);
    if (!os) throw new NotFoundError('Service order');
    if (os.status !== 'EXECUTION') throw new ValidationError('Service can only be started when OS is in EXECUTION status');

    for (const i of os.items) {
      const item = await this.itemRepo.findById(i.itemId);
      if (!item) throw new NotFoundError('Item');
      await this.itemRepo.update(i.itemId, {
        stockQuantity: item.stockQuantity - i.quantity,
        reservedQuantity: item.reservedQuantity - i.quantity,
      });
    }

    const updated = await this.osRepo.update(osId, { startedAt: new Date() });
    return updated!;
  }
}
