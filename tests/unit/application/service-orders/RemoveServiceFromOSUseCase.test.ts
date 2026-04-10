import { RemoveServiceFromOSUseCase } from '../../../../src/application/use-cases/service-orders/RemoveServiceFromOSUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';

const baseOS: ServiceOrder = {
  id: 'os-1', customerId: 'c-1', vehicleId: 'v-1',
  status: 'DIAGNOSIS', services: [{ serviceId: 's-1' }], items: [], createdAt: new Date(),
};

const makeRepo = (os: ServiceOrder | null): IServiceOrderRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(os),
  create: jest.fn(),
  update: jest.fn().mockImplementation((_id, data) => Promise.resolve({ ...baseOS, ...data })),
});

describe('RemoveServiceFromOSUseCase', () => {
  it('removes a service from the OS', async () => {
    const repo = makeRepo(baseOS);
    const useCase = new RemoveServiceFromOSUseCase(repo);
    await useCase.execute('os-1', 's-1');
    expect(repo.update).toHaveBeenCalledWith('os-1', { services: [] });
  });

  it('throws NotFoundError when OS does not exist', async () => {
    const useCase = new RemoveServiceFromOSUseCase(makeRepo(null));
    await expect(useCase.execute('missing', 's-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ValidationError when OS is not in DIAGNOSIS status', async () => {
    const wrongOS = { ...baseOS, status: 'RECEIVED' as const };
    const useCase = new RemoveServiceFromOSUseCase(makeRepo(wrongOS));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFoundError when service is not in order', async () => {
    const useCase = new RemoveServiceFromOSUseCase(makeRepo(baseOS));
    await expect(useCase.execute('os-1', 'not-in-order')).rejects.toMatchObject({ statusCode: 404 });
  });
});
