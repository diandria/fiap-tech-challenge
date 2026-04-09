import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { Item } from '../../../domain/entities/Item';
import { NotFoundError, ValidationError } from '../../../domain/errors/AppError';

export class ConsumeItemUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(id: string, quantity: number): Promise<Item> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError('Item');
    if (quantity > item.reservedQuantity) {
      throw new ValidationError('Cannot consume more than reserved quantity');
    }
    const updated = await this.repo.update(id, {
      stockQuantity: item.stockQuantity - quantity,
      reservedQuantity: item.reservedQuantity - quantity,
    });
    return updated!;
  }
}
