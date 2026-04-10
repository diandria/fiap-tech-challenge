import { GetServiceOrderUseCase } from '../../../../src/application/use-cases/service-orders/GetServiceOrderUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';

const os: ServiceOrder = {
  id: 'os-1', customerId: 'c-1', vehicleId: 'v-1',
  status: 'RECEIVED', services: [], items: [], createdAt: new Date(),
};

const makeRepo = (result: ServiceOrder | null): IServiceOrderRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(result),
  create: jest.fn(), update: jest.fn(),
});

describe('GetServiceOrderUseCase', () => {
  it('returns the service order when found', async () => {
    const useCase = new GetServiceOrderUseCase(makeRepo(os));
    const result = await useCase.execute('os-1');
    expect(result.id).toBe('os-1');
  });

  it('throws NotFoundError when OS does not exist', async () => {
    const useCase = new GetServiceOrderUseCase(makeRepo(null));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
