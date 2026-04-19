import { StartServiceUseCase } from '../../../../src/application/use-cases/service-orders/StartServiceUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';

const baseOS: ServiceOrder = {
  id: 'os-1', customerId: 'c-1', vehicleId: 'v-1',
  status: 'EXECUTION', services: [{ serviceId: 's-1' }, { serviceId: 's-other' }], items: [], createdAt: new Date(),
};

const makeRepo = (os: ServiceOrder | null): IServiceOrderRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(os),
  create: jest.fn(),
  update: jest.fn().mockImplementation((_id, data) => Promise.resolve({ ...baseOS, ...data })),
  getAvgExecutionByService: jest.fn().mockResolvedValue([]),
});

describe('StartServiceUseCase', () => {
  it('sets startedAt on the service', async () => {
    const repo = makeRepo(baseOS);
    const useCase = new StartServiceUseCase(repo);
    const result = await useCase.execute('os-1', 's-1');
    expect(result.services[0].startedAt).toBeDefined();
  });

  it('throws NotFoundError when OS does not exist', async () => {
    const useCase = new StartServiceUseCase(makeRepo(null));
    await expect(useCase.execute('missing', 's-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ValidationError when OS is not in EXECUTION status', async () => {
    const wrongOS = { ...baseOS, status: 'DIAGNOSIS' as const };
    const useCase = new StartServiceUseCase(makeRepo(wrongOS));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws NotFoundError when service is not in order', async () => {
    const useCase = new StartServiceUseCase(makeRepo(baseOS));
    await expect(useCase.execute('os-1', 'not-in-order')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ValidationError when service is already started', async () => {
    const alreadyStarted = {
      ...baseOS,
      services: [{ serviceId: 's-1', startedAt: new Date() }, { serviceId: 's-other' }],
    };
    const useCase = new StartServiceUseCase(makeRepo(alreadyStarted));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });
});
