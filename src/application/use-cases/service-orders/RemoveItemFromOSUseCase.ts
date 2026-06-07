import { IServiceOrderRepository } from '../../../use-cases/ports/IServiceOrderRepository';
import { IItemRepository } from '../../../use-cases/ports/IItemRepository';
import { ServiceOrder } from '../../../entities/ServiceOrder';
import { NotFoundError, ValidationError } from '../../../entities/errors/AppError';
import { findOSOrThrow } from '../../utils/serviceOrderUtils';

export class RemoveItemFromOSUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly itemRepo: IItemRepository,
  ) {}

  async execute(osId: string, itemId: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
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
