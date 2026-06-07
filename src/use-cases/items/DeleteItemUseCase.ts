import { IItemRepository } from '../ports/IItemRepository';
import { NotFoundError, ValidationError } from '../../entities/errors/AppError';

export class DeleteItemUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(id: string): Promise<void> {
    const item = await this.repo.findById(id);
    if (!item) throw new NotFoundError('Item');
    if (item.reservedQuantity > 0) {
      throw new ValidationError('Cannot delete item with active reserved stock');
    }
    await this.repo.delete(id);
  }
}
