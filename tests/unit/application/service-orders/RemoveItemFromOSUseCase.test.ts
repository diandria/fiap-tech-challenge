import { RemoveItemFromOSUseCase } from '../../../../src/use-cases/service-orders/RemoveItemFromOSUseCase';
import { makeOSRepo, baseOS } from '../../fixtures/serviceOrder';
import { makeItemRepo, reservedItem } from '../../fixtures/item';

const osWithItem = { ...baseOS, items: [{ itemId: 'i-1', quantity: 2 }] };

describe('RemoveItemFromOSUseCase', () => {
  it('GIVEN OS in DIAGNOSIS with item WHEN execute called THEN removes item and releases reservation', async () => {
    const osRepo = makeOSRepo(osWithItem);
    const itemRepo = makeItemRepo(reservedItem);
    const useCase = new RemoveItemFromOSUseCase(osRepo, itemRepo);
    await useCase.execute('os-1', 'i-1');
    expect(itemRepo.update).toHaveBeenCalledWith('i-1', { reservedQuantity: 1 });
    expect(osRepo.update).toHaveBeenCalledWith('os-1', { items: [] });
  });

  it('GIVEN item already deleted from catalog WHEN execute called THEN removes from OS without updating item', async () => {
    const osRepo = makeOSRepo(osWithItem);
    const itemRepo = makeItemRepo(null);
    const useCase = new RemoveItemFromOSUseCase(osRepo, itemRepo);
    await useCase.execute('os-1', 'i-1');
    expect(itemRepo.update).not.toHaveBeenCalled();
    expect(osRepo.update).toHaveBeenCalled();
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new RemoveItemFromOSUseCase(makeOSRepo(null), makeItemRepo(reservedItem));
    await expect(useCase.execute('missing', 'i-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN OS not in DIAGNOSIS WHEN execute called THEN throws ValidationError', async () => {
    const wrongOS = { ...osWithItem, status: 'RECEIVED' as const };
    const useCase = new RemoveItemFromOSUseCase(makeOSRepo(wrongOS), makeItemRepo(reservedItem));
    await expect(useCase.execute('os-1', 'i-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN item not in OS WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new RemoveItemFromOSUseCase(makeOSRepo(osWithItem), makeItemRepo(reservedItem));
    await expect(useCase.execute('os-1', 'not-in-order')).rejects.toMatchObject({ statusCode: 404 });
  });
});
