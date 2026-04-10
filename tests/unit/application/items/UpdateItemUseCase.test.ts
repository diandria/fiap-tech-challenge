import { UpdateItemUseCase } from '../../../../src/application/use-cases/items/UpdateItemUseCase';
import { IItemRepository } from '../../../../src/domain/ports/IItemRepository';
import { Item } from '../../../../src/domain/entities/Item';

const item: Item = { id: 'i-1', name: 'Filter', price: 25, stockQuantity: 10, reservedQuantity: 2 };

const makeRepo = (result: Item | null): IItemRepository => ({
  findAll: jest.fn(), findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn().mockResolvedValue(result),
  delete: jest.fn(),
});

describe('UpdateItemUseCase', () => {
  it('updates and returns item with availableQuantity', async () => {
    const repo = makeRepo(item);
    const useCase = new UpdateItemUseCase(repo);
    const result = await useCase.execute('i-1', { price: 30 });
    // availableQuantity = stockQuantity - reservedQuantity = 10 - 2 = 8
    expect(result.availableQuantity).toBe(8);
  });

  it('throws ValidationError for negative price', async () => {
    const useCase = new UpdateItemUseCase(makeRepo(item));
    await expect(useCase.execute('i-1', { price: -1 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ValidationError for negative stockQuantity', async () => {
    const useCase = new UpdateItemUseCase(makeRepo(item));
    await expect(useCase.execute('i-1', { stockQuantity: -5 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFoundError when item does not exist', async () => {
    const useCase = new UpdateItemUseCase(makeRepo(null));
    await expect(useCase.execute('missing', { price: 10 })).rejects.toMatchObject({ statusCode: 404 });
  });
});
