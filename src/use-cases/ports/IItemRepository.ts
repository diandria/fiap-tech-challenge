import { Item } from '../../entities/Item';

export interface IItemRepository {
  findAll(): Promise<Item[]>;
  findById(id: string): Promise<Item | null>;
  create(data: Omit<Item, 'id'>): Promise<Item>;
  update(id: string, data: Partial<Omit<Item, 'id'>>): Promise<Item | null>;
  /** Reserves `quantity` units if they are available; false when the stock no longer allows it. */
  reserve(id: string, quantity: number): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}
