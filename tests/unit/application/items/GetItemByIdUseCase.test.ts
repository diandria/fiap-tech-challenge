import { GetItemByIdUseCase } from '../../../../src/application/use-cases/items/GetItemByIdUseCase';
import { IItemRepository } from '../../../../src/domain/ports/IItemRepository';
import { Item } from '../../../../src/domain/entities/Item';

const item: Item = { id: 'i-1', name: 'Filter', price: 25, stockQuantity: 10, reservedQuantity: 2 };

const makeRepo = (result: Item | null): IItemRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(result),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

describe('GetItemByIdUseCase', () => {
  it('returns item with availableQuantity', async () => {
    const useCase = new GetItemByIdUseCase(makeRepo(item));
    const result = await useCase.execute('i-1');
    expect(result.availableQuantity).toBe(8); // 10 - 2
    expect(result.id).toBe('i-1');
  });

  it('throws NotFoundError when item does not exist', async () => {
    const useCase = new GetItemByIdUseCase(makeRepo(null));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
