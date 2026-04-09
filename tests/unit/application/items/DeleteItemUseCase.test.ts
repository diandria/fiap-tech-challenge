import { DeleteItemUseCase } from '../../../../src/application/use-cases/items/DeleteItemUseCase';
import { IItemRepository } from '../../../../src/domain/ports/IItemRepository';
import { Item } from '../../../../src/domain/entities/Item';

const freeItem: Item = { id: 'i-1', name: 'Filter', price: 10, stockQuantity: 5, reservedQuantity: 0 };
const reservedItem: Item = { id: 'i-2', name: 'Oil', price: 8, stockQuantity: 3, reservedQuantity: 2 };

const makeRepo = (found: Item | null, deleted = true): IItemRepository => ({
  findAll: jest.fn(),
  findById: jest.fn().mockResolvedValue(found),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn().mockResolvedValue(deleted),
  reserve: jest.fn(),
  release: jest.fn(),
  consume: jest.fn(),
});

describe('DeleteItemUseCase', () => {
  it('deletes an item with no reservations', async () => {
    const useCase = new DeleteItemUseCase(makeRepo(freeItem));
    await expect(useCase.execute('i-1')).resolves.toBeUndefined();
  });

  it('throws ValidationError if item has active reservations', async () => {
    const useCase = new DeleteItemUseCase(makeRepo(reservedItem));
    await expect(useCase.execute('i-2'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('reserved') });
  });

  it('throws NotFoundError if item does not exist', async () => {
    const useCase = new DeleteItemUseCase(makeRepo(null));
    await expect(useCase.execute('missing'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
