import { DeliverOSUseCase } from '../../../../src/application/use-cases/service-orders/DeliverOSUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';

const finishedOS: ServiceOrder = {
  id: 'os-1', customerId: 'c-1', vehicleId: 'v-1',
  status: 'FINISHED', services: [], items: [], createdAt: new Date(),
};

const makeRepo = (os: ServiceOrder | null): IServiceOrderRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(os),
  create: jest.fn(),
  update: jest.fn().mockImplementation((_id, data) => Promise.resolve({ ...finishedOS, ...data })),
});

describe('DeliverOSUseCase', () => {
  it('transitions OS from FINISHED to DELIVERED', async () => {
    const repo = makeRepo(finishedOS);
    const useCase = new DeliverOSUseCase(repo);
    const result = await useCase.execute('os-1');
    expect(result.status).toBe('DELIVERED');
    expect(result.deliveredAt).toBeDefined();
  });

  it('throws NotFoundError when OS does not exist', async () => {
    const useCase = new DeliverOSUseCase(makeRepo(null));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ValidationError for invalid transition', async () => {
    const wrongOS = { ...finishedOS, status: 'RECEIVED' as const };
    const useCase = new DeliverOSUseCase(makeRepo(wrongOS));
    await expect(useCase.execute('os-1')).rejects.toMatchObject({ statusCode: 400 });
  });
});
