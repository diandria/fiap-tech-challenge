import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { NotFoundError, ValidationError } from '../../../domain/errors/AppError';

export class RemoveItemFromOSUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly itemRepo: IItemRepository,
  ) {}

  async execute(osId: string, itemId: string): Promise<ServiceOrder> {
    const os = await this.osRepo.findById(osId);
    if (!os) throw new NotFoundError('Service order');
    if (os.status !== 'DIAGNOSIS') throw new ValidationError('Items can only be removed during DIAGNOSIS');

    const existing = os.items.find((i) => i.itemId === itemId);
    if (!existing) throw new NotFoundError('Item in order');

    const item = await this.itemRepo.findById(itemId);
    if (item) {
      await this.itemRepo.update(itemId, { reservedQuantity: item.reservedQuantity - existing.quantity });
    }

    const items = os.items.filter((i) => i.itemId !== itemId);
    const updated = await this.osRepo.update(osId, { items });
    return updated!;
  }
}
