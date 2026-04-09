import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { Item, getAvailableQuantity } from '../../../domain/entities/Item';
import { NotFoundError } from '../../../domain/errors/AppError';

export interface ItemWithAvailable extends Item {
  availableQuantity: number;
}

export class GetItemUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(id: string): Promise<ItemWithAvailable> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError('Item');
    return { ...item, availableQuantity: getAvailableQuantity(item) };
  }
}
