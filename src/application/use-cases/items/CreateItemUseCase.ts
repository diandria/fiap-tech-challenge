import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { Item } from '../../../domain/entities/Item';
import { ValidationError } from '../../../domain/errors/AppError';

interface CreateItemInput {
  name: string;
  price: number;
  stockQuantity: number;
}

export class CreateItemUseCase {
  constructor(private readonly repo: IItemRepository) {}

  async execute(input: CreateItemInput): Promise<Item> {
    if (input.price < 0) throw new ValidationError('Price cannot be negative');
    if (input.stockQuantity < 0) throw new ValidationError('Stock quantity cannot be negative');
    return this.repo.create({ ...input, reservedQuantity: 0 });
  }
}
