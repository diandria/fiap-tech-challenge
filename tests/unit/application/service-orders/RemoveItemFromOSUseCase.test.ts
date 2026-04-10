import { RemoveItemFromOSUseCase } from '../../../../src/application/use-cases/service-orders/RemoveItemFromOSUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { IItemRepository } from '../../../../src/domain/ports/IItemRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';
import { Item } from '../../../../src/domain/entities/Item';

const item: Item = { id: 'i-1', name: 'Filter', price: 25, stockQuantity: 10, reservedQuantity: 3 };

const baseOS: ServiceOrder = {
  id: 'os-1', customerId: 'c-1', vehicleId: 'v-1',
  status: 'DIAGNOSIS', services: [], items: [{ itemId: 'i-1', quantity: 2 }], createdAt: new Date(),
};

const makeOSRepo = (os: ServiceOrder | null): IServiceOrderRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(os),
  create: jest.fn(),
  update: jest.fn().mockImplementation((_id, data) => Promise.resolve({ ...baseOS, ...data })),
});

const makeItemRepo = (i: Item | null): IItemRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(i),
  create: jest.fn(), update: jest.fn().mockResolvedValue(i), delete: jest.fn(),
});

describe('RemoveItemFromOSUseCase', () => {
  it('removes item and releases reservation', async () => {
    const osRepo = makeOSRepo(baseOS);
    const itemRepo = makeItemRepo(item);
    const useCase = new RemoveItemFromOSUseCase(osRepo, itemRepo);
    await useCase.execute('os-1', 'i-1');
    // reservedQuantity: 3 - 2 = 1
    expect(itemRepo.update).toHaveBeenCalledWith('i-1', { reservedQuantity: 1 });
    expect(osRepo.update).toHaveBeenCalledWith('os-1', { items: [] });
  });

  it('removes item even if item repo returns null (already deleted)', async () => {
    const osRepo = makeOSRepo(baseOS);
    const itemRepo = makeItemRepo(null);
    const useCase = new RemoveItemFromOSUseCase(osRepo, itemRepo);
    await useCase.execute('os-1', 'i-1');
    expect(itemRepo.update).not.toHaveBeenCalled();
    expect(osRepo.update).toHaveBeenCalled();
  });

  it('throws NotFoundError when OS does not exist', async () => {
    const useCase = new RemoveItemFromOSUseCase(makeOSRepo(null), makeItemRepo(item));
    await expect(useCase.execute('missing', 'i-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ValidationError when OS is not in DIAGNOSIS status', async () => {
    const wrongOS = { ...baseOS, status: 'RECEIVED' as const };
    const useCase = new RemoveItemFromOSUseCase(makeOSRepo(wrongOS), makeItemRepo(item));
    await expect(useCase.execute('os-1', 'i-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFoundError when item is not in order', async () => {
    const useCase = new RemoveItemFromOSUseCase(makeOSRepo(baseOS), makeItemRepo(item));
    await expect(useCase.execute('os-1', 'not-in-order')).rejects.toMatchObject({ statusCode: 404 });
  });
});
