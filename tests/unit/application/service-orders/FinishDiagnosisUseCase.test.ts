import { FinishDiagnosisUseCase } from '../../../../src/application/use-cases/service-orders/FinishDiagnosisUseCase';
import { IServiceRepository } from '../../../../src/domain/ports/IServiceRepository';
import { makeOSRepo, baseOS } from '../../fixtures/serviceOrder';
import { makeItemRepo, stockedItem } from '../../fixtures/item';
import { baseService } from '../../fixtures/service';

const diagnosisOS = {
  ...baseOS,
  status: 'DIAGNOSIS' as const,
  services: [{ serviceId: 's-1' }, { serviceId: 's-2' }],
  items: [{ itemId: 'i-1', quantity: 2 }],
};

const makeServiceRepoForFinishDiagnosis = (): IServiceRepository => ({
  findAll: jest.fn(),
  findById: jest.fn()
    .mockResolvedValueOnce(baseService)
    .mockResolvedValueOnce({ ...baseService, id: 's-2', name: 'Tire Rotation', price: 50, estimatedMinutes: 20 }),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

describe('FinishDiagnosisUseCase', () => {
  it('GIVEN OS in DIAGNOSIS with services and items WHEN execute called THEN calculates budgetTotal and transitions to WAITING_APPROVAL', async () => {
    const osRepo = makeOSRepo(diagnosisOS);
    const itemRepo = makeItemRepo({ ...stockedItem, price: 25, stockQuantity: 10, reservedQuantity: 2 });
    const useCase = new FinishDiagnosisUseCase(osRepo, makeServiceRepoForFinishDiagnosis(), itemRepo);
    const result = await useCase.execute('os-1');
    // 80 + 50 + (25 * 2) = 180
    expect(result.budgetTotal).toBe(180);
    expect(result.status).toBe('WAITING_APPROVAL');
  });

  it('GIVEN OS not in DIAGNOSIS WHEN execute called THEN throws ValidationError', async () => {
    const osRepo = makeOSRepo({ ...diagnosisOS, status: 'RECEIVED' });
    const itemRepo = makeItemRepo(stockedItem);
    const useCase = new FinishDiagnosisUseCase(osRepo, makeServiceRepoForFinishDiagnosis(), itemRepo);
    await expect(useCase.execute('os-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const osRepo = makeOSRepo(null);
    const itemRepo = makeItemRepo(stockedItem);
    const useCase = new FinishDiagnosisUseCase(osRepo, makeServiceRepoForFinishDiagnosis(), itemRepo);
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
