import { StartServiceUseCase } from '../../../../src/application/use-cases/service-orders/StartServiceUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { IItemRepository } from '../../../../src/domain/ports/IItemRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';

const baseOS: ServiceOrder = {
  id: 'os-1', customerId: 'c-1', vehicleId: 'v-1',
  status: 'EXECUTION', budgetTotal: 200,
  services: [], items: [{ itemId: 'i-1', quantity: 2 }, { itemId: 'i-2', quantity: 1 }],
  createdAt: new Date(),
};

const makeOSRepo = (os = baseOS): IServiceOrderRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(os),
  create: jest.fn(),
  update: jest.fn().mockImplementation((_id, data) => Promise.resolve({ ...os, ...data })),
});

const makeItemRepo = (): IItemRepository => ({
  findAll: jest.fn(),
  findById: jest.fn()
    .mockResolvedValueOnce({ id: 'i-1', name: 'Filter', price: 25, stockQuantity: 10, reservedQuantity: 4 })
    .mockResolvedValueOnce({ id: 'i-2', name: 'Oil', price: 15, stockQuantity: 5, reservedQuantity: 1 }),
  create: jest.fn(),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn(),
});

describe('StartServiceUseCase', () => {
  it('consumes stock and sets startedAt when mechanic starts execution', async () => {
    const osRepo = makeOSRepo();
    const itemRepo = makeItemRepo();
    const useCase = new StartServiceUseCase(osRepo, itemRepo);
    const result = await useCase.execute('os-1');

    // i-1: stockQuantity (10-2=8), reservedQuantity (4-2=2)
    expect(itemRepo.update).toHaveBeenCalledWith('i-1', { stockQuantity: 8, reservedQuantity: 2 });
    // i-2: stockQuantity (5-1=4), reservedQuantity (1-1=0)
    expect(itemRepo.update).toHaveBeenCalledWith('i-2', { stockQuantity: 4, reservedQuantity: 0 });
    expect(osRepo.update).toHaveBeenCalledWith('os-1', expect.objectContaining({ startedAt: expect.any(Date) }));
    expect(result.status).toBe('EXECUTION');
  });

  it('throws ValidationError when OS is not in EXECUTION status', async () => {
    const wrongOS = { ...baseOS, status: 'WAITING_APPROVAL' as const };
    const useCase = new StartServiceUseCase(makeOSRepo(wrongOS), makeItemRepo());
    await expect(useCase.execute('os-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFoundError when OS does not exist', async () => {
    const osRepo: IServiceOrderRepository = {
      findAll: jest.fn(), findById: jest.fn().mockResolvedValue(null),
      create: jest.fn(), update: jest.fn(),
    };
    const useCase = new StartServiceUseCase(osRepo, makeItemRepo());
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
