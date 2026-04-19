import { FinishDiagnosisUseCase } from '../../../../src/application/use-cases/service-orders/FinishDiagnosisUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { IServiceRepository } from '../../../../src/domain/ports/IServiceRepository';
import { IItemRepository } from '../../../../src/domain/ports/IItemRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';

const baseOS: ServiceOrder = {
  id: 'os-1', customerId: 'c-1', vehicleId: 'v-1',
  status: 'DIAGNOSIS',
  services: [{ serviceId: 's-1' }, { serviceId: 's-2' }],
  items: [{ itemId: 'i-1', quantity: 2 }],
  createdAt: new Date(),
};

const makeOSRepo = (): IServiceOrderRepository => ({
  findAll: jest.fn(),
  findById: jest.fn().mockResolvedValue(baseOS),
  create: jest.fn(),
  update: jest.fn().mockImplementation((_id, data) => Promise.resolve({ ...baseOS, ...data })),
  getAvgExecutionByService: jest.fn().mockResolvedValue([]),
});

const makeServiceRepo = (): IServiceRepository => ({
  findAll: jest.fn(),
  findById: jest.fn()
    .mockResolvedValueOnce({ id: 's-1', name: 'Oil Change', price: 80, estimatedMinutes: 30 })
    .mockResolvedValueOnce({ id: 's-2', name: 'Tire Rotation', price: 50, estimatedMinutes: 20 }),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

const makeItemRepo = (): IItemRepository => ({
  findAll: jest.fn(),
  findById: jest.fn().mockResolvedValue({ id: 'i-1', name: 'Filter', price: 25, stockQuantity: 10, reservedQuantity: 2 }),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

describe('FinishDiagnosisUseCase', () => {
  it('calculates budgetTotal as sum of services + items×qty and transitions to WAITING_APPROVAL', async () => {
    const osRepo = makeOSRepo();
    const useCase = new FinishDiagnosisUseCase(osRepo, makeServiceRepo(), makeItemRepo());
    const result = await useCase.execute('os-1');
    // 80 + 50 + (25 * 2) = 180
    expect(result.budgetTotal).toBe(180);
    expect(result.status).toBe('WAITING_APPROVAL');
  });

  it('throws ValidationError when OS is not in DIAGNOSIS status', async () => {
    const osRepo: IServiceOrderRepository = {
      findAll: jest.fn(),
      findById: jest.fn().mockResolvedValue({ ...baseOS, status: 'RECEIVED' }),
      create: jest.fn(), update: jest.fn(),
      getAvgExecutionByService: jest.fn().mockResolvedValue([]),
    };
    const useCase = new FinishDiagnosisUseCase(osRepo, makeServiceRepo(), makeItemRepo());
    await expect(useCase.execute('os-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFoundError when OS does not exist', async () => {
    const osRepo: IServiceOrderRepository = {
      findAll: jest.fn(), findById: jest.fn().mockResolvedValue(null),
      create: jest.fn(), update: jest.fn(),
      getAvgExecutionByService: jest.fn().mockResolvedValue([]),
    };
    const useCase = new FinishDiagnosisUseCase(osRepo, makeServiceRepo(), makeItemRepo());
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
