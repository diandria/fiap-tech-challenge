import { IItemRepository } from '../../../use-cases/ports/IItemRepository';
import { getAvailableQuantity } from '../../../entities/Item';
import { ItemWithAvailable } from './GetItemByIdUseCase';

export class ListItemsUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(): Promise<ItemWithAvailable[]> {
    const items = await this.repo.findAll();
    return items.map((item) => ({ ...item, availableQuantity: getAvailableQuantity(item) }));
  }
}
