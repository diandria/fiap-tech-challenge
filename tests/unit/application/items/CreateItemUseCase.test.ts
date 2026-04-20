import { CreateItemUseCase } from '../../../../src/application/use-cases/items/CreateItemUseCase';
import { makeItemRepo, stockedItem } from '../../fixtures/item';

describe('CreateItemUseCase', () => {
  it('GIVEN valid item data WHEN execute called THEN creates item with reservedQuantity defaulting to 0', async () => {
    const repo = makeItemRepo(null);
    (repo.create as jest.Mock).mockImplementation((data) => Promise.resolve({ id: 'i-1', ...data }));
    const useCase = new CreateItemUseCase(repo);
    const result = await useCase.execute({
      name: stockedItem.name,
      price: stockedItem.price,
      stockQuantity: stockedItem.stockQuantity,
    });
    expect(result.reservedQuantity).toBe(0);
    expect(result.stockQuantity).toBe(stockedItem.stockQuantity);
  });

  it('GIVEN negative stockQuantity WHEN execute called THEN throws ValidationError', async () => {
    const useCase = new CreateItemUseCase(makeItemRepo(null));
    await expect(useCase.execute({ name: 'Filter', price: 10, stockQuantity: -1 }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN negative price WHEN execute called THEN throws ValidationError', async () => {
    const useCase = new CreateItemUseCase(makeItemRepo(null));
    await expect(useCase.execute({ name: 'Filter', price: -5, stockQuantity: 5 }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
