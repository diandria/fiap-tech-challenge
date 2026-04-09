import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { getAvailableQuantity } from '../../../domain/entities/Item';
import { ItemWithAvailable } from './GetItemUseCase';

export class ListItemsUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(): Promise<ItemWithAvailable[]> {
    const items = await this.repo.findAll();
    return items.map((item) => ({ ...item, availableQuantity: getAvailableQuantity(item) }));
  }
}
