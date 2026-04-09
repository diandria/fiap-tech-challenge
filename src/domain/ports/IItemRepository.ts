import { Item } from '../entities/Item';

export interface IItemRepository {
  findAll(): Promise<Item[]>;
  findById(id: string): Promise<Item | null>;
  create(data: Omit<Item, 'id'>): Promise<Item>;
  update(id: string, data: Partial<Omit<Item, 'id'>>): Promise<Item | null>;
  delete(id: string): Promise<boolean>;
  /** Increment reservedQuantity by quantity */
  reserve(id: string, quantity: number): Promise<Item>;
  /** Decrement reservedQuantity by quantity */
  release(id: string, quantity: number): Promise<Item>;
  /** Decrement both stockQuantity and reservedQuantity by quantity */
  consume(id: string, quantity: number): Promise<Item>;
}
