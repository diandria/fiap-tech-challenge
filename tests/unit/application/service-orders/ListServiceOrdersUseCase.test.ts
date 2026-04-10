import { ListServiceOrdersUseCase } from '../../../../src/application/use-cases/service-orders/ListServiceOrdersUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';

const orders: ServiceOrder[] = [
  { id: 'os-1', customerId: 'c-1', vehicleId: 'v-1', status: 'RECEIVED', services: [], items: [], createdAt: new Date() },
];

const makeRepo = (): IServiceOrderRepository => ({
  findAll: jest.fn().mockResolvedValue(orders),
  findById: jest.fn(), create: jest.fn(), update: jest.fn(),
});

describe('ListServiceOrdersUseCase', () => {
  it('returns all service orders', async () => {
    const repo = makeRepo();
    const useCase = new ListServiceOrdersUseCase(repo);
    const result = await useCase.execute();
    expect(repo.findAll).toHaveBeenCalledWith(undefined);
    expect(result).toHaveLength(1);
  });

  it('passes filter to repository', async () => {
    const repo = makeRepo();
    const useCase = new ListServiceOrdersUseCase(repo);
    const from = new Date('2024-01-01');
    const to = new Date('2024-12-31');
    await useCase.execute({ status: 'RECEIVED', customerId: 'c-1', from, to });
    expect(repo.findAll).toHaveBeenCalledWith({ status: 'RECEIVED', customerId: 'c-1', from, to });
  });
});
