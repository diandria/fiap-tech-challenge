import { FinishDiagnosisUseCase } from '../../../../src/use-cases/service-orders/FinishDiagnosisUseCase';
import { IServiceRepository } from '../../../../src/use-cases/ports/IServiceRepository';
import { INotificationService } from '../../../../src/use-cases/ports/INotificationService';
import { makeOSRepo, baseOS } from '../../fixtures/serviceOrder';
import { makeItemRepo, stockedItem } from '../../fixtures/item';
import { baseService } from '../../fixtures/service';
import { makeCustomerRepo, cpfCustomer } from '../../fixtures/customer';

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

const makeNotifier = (): INotificationService => ({
  notifyStatusChanged: jest.fn().mockResolvedValue(undefined),
  notifyBudgetReady: jest.fn().mockResolvedValue(undefined),
});

describe('FinishDiagnosisUseCase', () => {
  it('GIVEN OS in DIAGNOSIS with services and items WHEN execute called THEN calculates budgetTotal and transitions to WAITING_APPROVAL', async () => {
    const osRepo = makeOSRepo(diagnosisOS);
    const itemRepo = makeItemRepo({ ...stockedItem, price: 25, stockQuantity: 10, reservedQuantity: 2 });
    const useCase = new FinishDiagnosisUseCase(
      osRepo, makeServiceRepoForFinishDiagnosis(), itemRepo, makeCustomerRepo(), makeNotifier(),
    );
    const result = await useCase.execute('os-1');
    // 80 + 50 + (25 * 2) = 180
    expect(result.budgetTotal).toBe(180);
    expect(result.status).toBe('WAITING_APPROVAL');
  });

  it('GIVEN OS not in DIAGNOSIS WHEN execute called THEN throws ValidationError', async () => {
    const osRepo = makeOSRepo({ ...diagnosisOS, status: 'RECEIVED' });
    const itemRepo = makeItemRepo(stockedItem);
    const useCase = new FinishDiagnosisUseCase(
      osRepo, makeServiceRepoForFinishDiagnosis(), itemRepo, makeCustomerRepo(), makeNotifier(),
    );
    await expect(useCase.execute('os-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const osRepo = makeOSRepo(null);
    const itemRepo = makeItemRepo(stockedItem);
    const useCase = new FinishDiagnosisUseCase(
      osRepo, makeServiceRepoForFinishDiagnosis(), itemRepo, makeCustomerRepo(), makeNotifier(),
    );
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN OS in DIAGNOSIS WHEN execute called THEN notifier.notifyBudgetReady is called with customer and updated OS', async () => {
    const osRepo = makeOSRepo(diagnosisOS);
    const itemRepo = makeItemRepo({ ...stockedItem, price: 25, stockQuantity: 10, reservedQuantity: 2 });
    const customerRepo = makeCustomerRepo(cpfCustomer);
    const notifier = makeNotifier();
    const useCase = new FinishDiagnosisUseCase(
      osRepo, makeServiceRepoForFinishDiagnosis(), itemRepo, customerRepo, notifier,
    );
    const result = await useCase.execute('os-1');
    expect(customerRepo.findById).toHaveBeenCalledWith(diagnosisOS.customerId);
    expect(notifier.notifyBudgetReady).toHaveBeenCalledTimes(1);
    expect(notifier.notifyBudgetReady).toHaveBeenCalledWith(cpfCustomer, result);
  });

  it('GIVEN notifier throws WHEN execute called THEN transition still succeeds and error is swallowed', async () => {
    const osRepo = makeOSRepo(diagnosisOS);
    const itemRepo = makeItemRepo({ ...stockedItem, price: 25, stockQuantity: 10, reservedQuantity: 2 });
    const notifier: INotificationService = {
      notifyStatusChanged: jest.fn().mockResolvedValue(undefined),
      notifyBudgetReady: jest.fn().mockRejectedValue(new Error('SMTP down')),
    };
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const useCase = new FinishDiagnosisUseCase(
      osRepo, makeServiceRepoForFinishDiagnosis(), itemRepo, makeCustomerRepo(), notifier,
    );
    const result = await useCase.execute('os-1');
    expect(result.status).toBe('WAITING_APPROVAL');
    expect(notifier.notifyBudgetReady).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('GIVEN customer not found WHEN execute called THEN notifier is NOT called and transition still succeeds', async () => {
    const osRepo = makeOSRepo(diagnosisOS);
    const itemRepo = makeItemRepo({ ...stockedItem, price: 25, stockQuantity: 10, reservedQuantity: 2 });
    const customerRepo = makeCustomerRepo(null);
    const notifier = makeNotifier();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const useCase = new FinishDiagnosisUseCase(
      osRepo, makeServiceRepoForFinishDiagnosis(), itemRepo, customerRepo, notifier,
    );
    const result = await useCase.execute('os-1');
    expect(result.status).toBe('WAITING_APPROVAL');
    expect(notifier.notifyBudgetReady).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
