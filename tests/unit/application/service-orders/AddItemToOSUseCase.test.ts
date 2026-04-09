import { AddItemToOSUseCase } from '../../../../src/application/use-cases/service-orders/AddItemToOSUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { IItemRepository } from '../../../../src/domain/ports/IItemRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';
import { Item } from '../../../../src/domain/entities/Item';

const baseOS: ServiceOrder = {
  id: 'os-1', customerId: 'c-1', vehicleId: 'v-1',
  status: 'DIAGNOSIS', budgetTotal: undefined,
  services: [], items: [], createdAt: new Date(),
};

const stockedItem: Item = { id: 'i-1', name: 'Filter', price: 25, stockQuantity: 10, reservedQuantity: 2 };
const depletedItem: Item = { id: 'i-2', name: 'Oil', price: 15, stockQuantity: 3, reservedQuantity: 3 };

const makeOSRepo = (os: ServiceOrder | null): IServiceOrderRepository => ({
  findAll: jest.fn(),
  findById: jest.fn().mockResolvedValue(os),
  create: jest.fn(),
  update: jest.fn().mockImplementation((_id, data) => Promise.resolve({ ...baseOS, ...data })),
});

const makeItemRepo = (item: Item | null): IItemRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(item),
  create: jest.fn(), update: jest.fn().mockResolvedValue(item), delete: jest.fn(),
});

describe('AddItemToOSUseCase', () => {
  it('adds an item and reserves stock', async () => {
    const osRepo = makeOSRepo(baseOS);
    const itemRepo = makeItemRepo(stockedItem);
    const useCase = new AddItemToOSUseCase(osRepo, itemRepo);
    await useCase.execute('os-1', 'i-1', 3);
    // stockedItem.reservedQuantity (2) + 3 = 5
    expect(itemRepo.update).toHaveBeenCalledWith('i-1', { reservedQuantity: 5 });
    expect(osRepo.update).toHaveBeenCalled();
  });

  it('throws ValidationError when available stock is insufficient', async () => {
    const useCase = new AddItemToOSUseCase(makeOSRepo(baseOS), makeItemRepo(depletedItem));
    await expect(useCase.execute('os-1', 'i-2', 1))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('stock') });
  });

  it('throws ValidationError when OS is not in DIAGNOSIS status', async () => {
    const wrongStatusOS = { ...baseOS, status: 'RECEIVED' as const };
    const useCase = new AddItemToOSUseCase(makeOSRepo(wrongStatusOS), makeItemRepo(stockedItem));
    await expect(useCase.execute('os-1', 'i-1', 1))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFoundError when item does not exist', async () => {
    const useCase = new AddItemToOSUseCase(makeOSRepo(baseOS), makeItemRepo(null));
    await expect(useCase.execute('os-1', 'missing', 1))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
