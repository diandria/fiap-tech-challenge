import { Item } from '../../../src/entities/Item';
import { IItemRepository } from '../../../src/use-cases/ports/IItemRepository';

export const stockedItem: Item = {
  id: 'i-1',
  name: 'Oil Filter',
  price: 25,
  stockQuantity: 10,
  reservedQuantity: 0,
};

export const depletedItem: Item = {
  ...stockedItem,
  stockQuantity: 2,
  reservedQuantity: 2,
};

export const reservedItem: Item = {
  ...stockedItem,
  stockQuantity: 5,
  reservedQuantity: 3,
};

export const freeItem: Item = {
  ...stockedItem,
  reservedQuantity: 0,
};

export const makeItemRepo = (
  found: Item | null = stockedItem,
  options?: { updateResult?: Item },
): IItemRepository => ({
  findAll: jest.fn().mockResolvedValue(found ? [found] : []),
  findById: jest.fn().mockResolvedValue(found),
  create: jest.fn().mockResolvedValue(found ?? stockedItem),
  update: jest.fn().mockImplementation((_id: string, data: Partial<Item>) =>
    Promise.resolve(options?.updateResult ?? (found ? { ...found, ...data } : null))
  ),
  delete: jest.fn().mockResolvedValue(true),
});
