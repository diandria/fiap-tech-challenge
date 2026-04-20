import { GetItemByIdUseCase } from '../../../../src/application/use-cases/items/GetItemByIdUseCase';
import { makeItemRepo, stockedItem } from '../../fixtures/item';

describe('GetItemByIdUseCase', () => {
  it('GIVEN existing item WHEN execute called THEN returns item with computed availableQuantity', async () => {
    const item = { ...stockedItem, stockQuantity: 10, reservedQuantity: 2 };
    const useCase = new GetItemByIdUseCase(makeItemRepo(item));
    const result = await useCase.execute('i-1');
    expect(result.availableQuantity).toBe(8);
    expect(result.id).toBe('i-1');
  });

  it('GIVEN non-existing item WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new GetItemByIdUseCase(makeItemRepo(null));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
