import { CreateServiceOrderUseCase } from '../../../../src/application/use-cases/service-orders/CreateServiceOrderUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';

const created: ServiceOrder = {
  id: 'os-1', customerId: 'c-1', vehicleId: 'v-1',
  status: 'RECEIVED', budgetTotal: undefined,
  services: [], items: [], createdAt: new Date(),
};

const makeRepo = (): IServiceOrderRepository => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn().mockResolvedValue(created),
  update: jest.fn(),
  getAvgExecutionByService: jest.fn().mockResolvedValue([]),
});

describe('CreateServiceOrderUseCase', () => {
  it('creates a service order with RECEIVED status', async () => {
    const repo = makeRepo();
    const useCase = new CreateServiceOrderUseCase(repo);
    const result = await useCase.execute({ customerId: 'c-1', vehicleId: 'v-1' });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'c-1', vehicleId: 'v-1', status: 'RECEIVED',
    }));
    expect(result.status).toBe('RECEIVED');
  });
});
