import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { IItemRepository } from '../ports/IItemRepository';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { getAvailableQuantity } from '../../entities/Item';
import { NotFoundError, ValidationError } from '../../entities/errors/AppError';
import { findOSOrThrow } from '../utils/serviceOrderUtils';

export class AddItemToOSUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly itemRepo: IItemRepository,
  ) {}

  async execute(osId: string, itemId: string, quantity: number): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    if (os.status !== 'DIAGNOSIS') throw new ValidationError('Items can only be added during DIAGNOSIS');

    const item = await this.itemRepo.findById(itemId);
    if (!item) throw new NotFoundError('Item');

    if (getAvailableQuantity(item) < quantity) {
      throw new ValidationError('Insufficient stock available');
    }

    await this.itemRepo.update(itemId, { reservedQuantity: item.reservedQuantity + quantity });

    const existing = os.items.find((i) => i.itemId === itemId);
    const items = existing
      ? os.items.map((i) => (i.itemId === itemId ? { itemId, quantity: i.quantity + quantity } : i))
      : [...os.items, { itemId, quantity }];

    const updated = await this.osRepo.update(osId, { items });
    return updated!;
  }
}
