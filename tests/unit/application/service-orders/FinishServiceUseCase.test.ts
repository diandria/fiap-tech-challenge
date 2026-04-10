import { FinishServiceUseCase } from '../../../../src/application/use-cases/service-orders/FinishServiceUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';

const startedAt = new Date();

const baseOS: ServiceOrder = {
  id: 'os-1', customerId: 'c-1', vehicleId: 'v-1',
  status: 'EXECUTION',
  services: [{ serviceId: 's-1', startedAt }, { serviceId: 's-other', startedAt }],
  items: [], createdAt: new Date(),
};

const makeRepo = (os: ServiceOrder | null): IServiceOrderRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(os),
  create: jest.fn(),
  update: jest.fn().mockImplementation((_id, data) => Promise.resolve({ ...baseOS, ...data })),
});

describe('FinishServiceUseCase', () => {
  it('sets finishedAt on the service', async () => {
    const repo = makeRepo(baseOS);
    const useCase = new FinishServiceUseCase(repo);
    const result = await useCase.execute('os-1', 's-1');
    expect(result.services[0].finishedAt).toBeDefined();
  });

  it('throws NotFoundError when OS does not exist', async () => {
    const useCase = new FinishServiceUseCase(makeRepo(null));
    await expect(useCase.execute('missing', 's-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ValidationError when OS is not in EXECUTION status', async () => {
    const wrongOS = { ...baseOS, status: 'DIAGNOSIS' as const };
    const useCase = new FinishServiceUseCase(makeRepo(wrongOS));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFoundError when service is not in order', async () => {
    const useCase = new FinishServiceUseCase(makeRepo(baseOS));
    await expect(useCase.execute('os-1', 'not-in-order')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ValidationError when service has not been started', async () => {
    const notStarted = { ...baseOS, services: [{ serviceId: 's-1' }, { serviceId: 's-other', startedAt }] };
    const useCase = new FinishServiceUseCase(makeRepo(notStarted));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ValidationError when service is already finished', async () => {
    const alreadyDone = {
      ...baseOS,
      services: [{ serviceId: 's-1', startedAt, finishedAt: new Date() }, { serviceId: 's-other', startedAt }],
    };
    const useCase = new FinishServiceUseCase(makeRepo(alreadyDone));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });
});
