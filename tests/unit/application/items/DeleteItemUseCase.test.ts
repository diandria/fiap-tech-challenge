import { DeleteItemUseCase } from '../../../../src/use-cases/items/DeleteItemUseCase';
import { makeItemRepo, freeItem, reservedItem } from '../../fixtures/item';

describe('DeleteItemUseCase', () => {
  it('GIVEN item with no reservations WHEN delete called THEN resolves without error', async () => {
    const useCase = new DeleteItemUseCase(makeItemRepo(freeItem));
    await expect(useCase.execute('i-1')).resolves.toBeUndefined();
  });

  it('GIVEN item with active reservations WHEN delete called THEN throws ValidationError', async () => {
    const useCase = new DeleteItemUseCase(makeItemRepo(reservedItem));
    await expect(useCase.execute('i-1'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('reserved') });
  });

  it('GIVEN non-existing item WHEN delete called THEN throws NotFoundError', async () => {
    const useCase = new DeleteItemUseCase(makeItemRepo(null));
    await expect(useCase.execute('missing'))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
