import { UpdateItemUseCase } from '../../../../src/application/use-cases/items/UpdateItemUseCase';
import { makeItemRepo, stockedItem } from '../../fixtures/item';

describe('UpdateItemUseCase', () => {
  it('GIVEN existing item WHEN update called THEN returns item with computed availableQuantity', async () => {
    const item = { ...stockedItem, stockQuantity: 10, reservedQuantity: 2 };
    const repo = makeItemRepo(item, { updateResult: item });
    const useCase = new UpdateItemUseCase(repo);
    const result = await useCase.execute('i-1', { price: 30 });
    // availableQuantity = stockQuantity - reservedQuantity = 10 - 2 = 8
    expect(result.availableQuantity).toBe(8);
  });

  it('GIVEN negative price WHEN update called THEN throws ValidationError', async () => {
    const useCase = new UpdateItemUseCase(makeItemRepo(stockedItem));
    await expect(useCase.execute('i-1', { price: -1 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN negative stockQuantity WHEN update called THEN throws ValidationError', async () => {
    const useCase = new UpdateItemUseCase(makeItemRepo(stockedItem));
    await expect(useCase.execute('i-1', { stockQuantity: -5 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN non-existing item WHEN update called THEN throws NotFoundError', async () => {
    const repo = makeItemRepo(null, { updateResult: null as any });
    const useCase = new UpdateItemUseCase(repo);
    await expect(useCase.execute('missing', { price: 10 })).rejects.toMatchObject({ statusCode: 404 });
  });
});
