import { IItemRepository } from '../ports/IItemRepository';
import { Item, getAvailableQuantity } from '../../entities/Item';
import { NotFoundError } from '../../entities/errors/AppError';

export interface ItemWithAvailable extends Item {
  availableQuantity: number;
}

export class GetItemByIdUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(id: string): Promise<ItemWithAvailable> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError('Item');
    return { ...item, availableQuantity: getAvailableQuantity(item) };
  }
}
