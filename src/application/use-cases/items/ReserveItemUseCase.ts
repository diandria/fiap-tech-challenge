import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { Item, getAvailableQuantity } from '../../../domain/entities/Item';
import { NotFoundError, ValidationError } from '../../../domain/errors/AppError';

export class ReserveItemUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(id: string, quantity: number): Promise<Item> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError('Item');
    if (quantity > getAvailableQuantity(item)) {
      throw new ValidationError('Insufficient available stock');
    }
    const updated = await this.repo.update(id, {
      reservedQuantity: item.reservedQuantity + quantity,
    });
    return updated!;
  }
}
