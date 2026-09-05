import { AddItemToOSUseCase } from '../../../../src/use-cases/service-orders/AddItemToOSUseCase';
import { makeOSRepo, baseOS } from '../../fixtures/serviceOrder';
import { makeItemRepo, stockedItem, depletedItem } from '../../fixtures/item';

describe('AddItemToOSUseCase', () => {
  it('GIVEN OS in DIAGNOSIS and item with available stock WHEN execute called THEN adds item and reserves stock', async () => {
    const item = { ...stockedItem, reservedQuantity: 2 };
    const osRepo = makeOSRepo(baseOS);
    const itemRepo = makeItemRepo(item);
    const useCase = new AddItemToOSUseCase(osRepo, itemRepo);
    await useCase.execute('os-1', 'i-1', 3);
    expect(itemRepo.update).toHaveBeenCalledWith('i-1', { reservedQuantity: 5 });
    expect(osRepo.update).toHaveBeenCalled();
  });

  it('GIVEN item with insufficient available stock WHEN execute called THEN throws ValidationError', async () => {
    const useCase = new AddItemToOSUseCase(makeOSRepo(baseOS), makeItemRepo(depletedItem));
    await expect(useCase.execute('os-1', 'i-1', 1))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('stock') });
  });

  it('GIVEN OS not in DIAGNOSIS WHEN execute called THEN throws ValidationError', async () => {
    const wrongStatusOS = { ...baseOS, status: 'RECEIVED' as const };
    const useCase = new AddItemToOSUseCase(makeOSRepo(wrongStatusOS), makeItemRepo(stockedItem));
    await expect(useCase.execute('os-1', 'i-1', 1))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new AddItemToOSUseCase(makeOSRepo(null), makeItemRepo(stockedItem));
    await expect(useCase.execute('missing', 'i-1', 1))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN non-existing item in catalog WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new AddItemToOSUseCase(makeOSRepo(baseOS), makeItemRepo(null));
    await expect(useCase.execute('os-1', 'missing', 1))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN item already in OS WHEN execute called THEN updates quantity alongside other items', async () => {
    const osWithItems = {
      ...baseOS,
      items: [{ itemId: 'i-1', quantity: 1 }, { itemId: 'i-other', quantity: 5 }],
    };
    const osRepo = makeOSRepo(osWithItems);
    const useCase = new AddItemToOSUseCase(osRepo, makeItemRepo(stockedItem));
    await useCase.execute('os-1', 'i-1', 2);
    expect(osRepo.update).toHaveBeenCalledWith('os-1', {
      items: [{ itemId: 'i-1', quantity: 3 }, { itemId: 'i-other', quantity: 5 }],
    });
  });
});
