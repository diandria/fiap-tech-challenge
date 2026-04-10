import { FinishOSUseCase } from '../../../../src/application/use-cases/service-orders/FinishOSUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';

const executionOS: ServiceOrder = {
  id: 'os-1', customerId: 'c-1', vehicleId: 'v-1',
  status: 'EXECUTION', services: [], items: [], createdAt: new Date(),
};

const makeRepo = (os: ServiceOrder | null): IServiceOrderRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(os),
  create: jest.fn(),
  update: jest.fn().mockImplementation((_id, data) => Promise.resolve({ ...executionOS, ...data })),
});

describe('FinishOSUseCase', () => {
  it('transitions OS from EXECUTION to FINISHED', async () => {
    const repo = makeRepo(executionOS);
    const useCase = new FinishOSUseCase(repo);
    const result = await useCase.execute('os-1');
    expect(result.status).toBe('FINISHED');
    expect(result.finishedAt).toBeDefined();
  });

  it('throws NotFoundError when OS does not exist', async () => {
    const useCase = new FinishOSUseCase(makeRepo(null));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ValidationError for invalid transition', async () => {
    const wrongOS = { ...executionOS, status: 'RECEIVED' as const };
    const useCase = new FinishOSUseCase(makeRepo(wrongOS));
    await expect(useCase.execute('os-1')).rejects.toMatchObject({ statusCode: 400 });
  });
});
