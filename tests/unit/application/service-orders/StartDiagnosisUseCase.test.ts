import { StartDiagnosisUseCase } from '../../../../src/application/use-cases/service-orders/StartDiagnosisUseCase';
import { IServiceOrderRepository } from '../../../../src/domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../../src/domain/entities/ServiceOrder';

const receivedOS: ServiceOrder = {
  id: 'os-1', customerId: 'c-1', vehicleId: 'v-1',
  status: 'RECEIVED', services: [], items: [], createdAt: new Date(),
};

const makeRepo = (os: ServiceOrder | null): IServiceOrderRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(os),
  create: jest.fn(),
  update: jest.fn().mockImplementation((_id, data) => Promise.resolve({ ...receivedOS, ...data })),
  getAvgExecutionByService: jest.fn().mockResolvedValue([]),
});

describe('StartDiagnosisUseCase', () => {
  it('transitions OS from RECEIVED to DIAGNOSIS', async () => {
    const repo = makeRepo(receivedOS);
    const useCase = new StartDiagnosisUseCase(repo);
    const result = await useCase.execute('os-1');
    expect(repo.update).toHaveBeenCalledWith('os-1', { status: 'DIAGNOSIS' });
    expect(result.status).toBe('DIAGNOSIS');
  });

  it('throws NotFoundError when OS does not exist', async () => {
    const useCase = new StartDiagnosisUseCase(makeRepo(null));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws ValidationError for invalid transition', async () => {
    const wrongOS = { ...receivedOS, status: 'DELIVERED' as const };
    const useCase = new StartDiagnosisUseCase(makeRepo(wrongOS));
    await expect(useCase.execute('os-1')).rejects.toMatchObject({ statusCode: 400 });
  });
});
