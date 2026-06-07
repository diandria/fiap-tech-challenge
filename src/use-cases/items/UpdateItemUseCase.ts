import { IItemRepository } from '../ports/IItemRepository';
import { Item, getAvailableQuantity } from '../../entities/Item';
import { NotFoundError, ValidationError } from '../../entities/errors/AppError';
import { ItemWithAvailable } from './GetItemByIdUseCase';

export class UpdateItemUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(id: string, data: Partial<Pick<Item, 'name' | 'price' | 'stockQuantity'>>): Promise<ItemWithAvailable> {
    if (data.price !== undefined && data.price < 0) throw new ValidationError('Price cannot be negative');
    if (data.stockQuantity !== undefined && data.stockQuantity < 0) throw new ValidationError('Stock quantity cannot be negative');
    const updated = await this.repo.update(id, data);
    if (!updated) throw new NotFoundError('Item');
    return { ...updated, availableQuantity: getAvailableQuantity(updated) };
  }
}
