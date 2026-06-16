import { NotifyStatusChangeUseCase } from '../../../../src/use-cases/service-orders/NotifyStatusChangeUseCase';
import { INotificationService } from '../../../../src/use-cases/ports/INotificationService';
import { makeOSRepo, baseOS } from '../../fixtures/serviceOrder';
import { makeCustomerRepo, cpfCustomer } from '../../fixtures/customer';

const makeNotifier = (): INotificationService => ({
  notifyStatusChanged: jest.fn().mockResolvedValue(undefined),
  notifyBudgetReady: jest.fn().mockResolvedValue(undefined),
});

describe('NotifyStatusChangeUseCase', () => {
  it('GIVEN valid osId WHEN execute called THEN calls notifyStatusChanged with customer and OS', async () => {
    const osRepo = makeOSRepo(baseOS);
    const customerRepo = makeCustomerRepo(cpfCustomer);
    const notifier = makeNotifier();
    const useCase = new NotifyStatusChangeUseCase(osRepo, customerRepo, notifier);

    await useCase.execute({ osId: 'os-1' });

    expect(customerRepo.findById).toHaveBeenCalledWith(baseOS.customerId);
    expect(notifier.notifyStatusChanged).toHaveBeenCalledTimes(1);
    expect(notifier.notifyStatusChanged).toHaveBeenCalledWith(cpfCustomer, baseOS);
  });

  it('GIVEN OS not found WHEN execute called THEN returns silently without calling notifier', async () => {
    const osRepo = makeOSRepo(null);
    const customerRepo = makeCustomerRepo(cpfCustomer);
    const notifier = makeNotifier();
    const useCase = new NotifyStatusChangeUseCase(osRepo, customerRepo, notifier);

    await useCase.execute({ osId: 'missing' });

    expect(notifier.notifyStatusChanged).not.toHaveBeenCalled();
  });

  it('GIVEN customer not found WHEN execute called THEN warns and does not call notifier', async () => {
    const osRepo = makeOSRepo(baseOS);
    const customerRepo = makeCustomerRepo(null);
    const notifier = makeNotifier();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const useCase = new NotifyStatusChangeUseCase(osRepo, customerRepo, notifier);

    await useCase.execute({ osId: 'os-1' });

    expect(notifier.notifyStatusChanged).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('GIVEN notifier throws WHEN execute called THEN error is swallowed and method still resolves', async () => {
    const osRepo = makeOSRepo(baseOS);
    const customerRepo = makeCustomerRepo(cpfCustomer);
    const notifier: INotificationService = {
      notifyStatusChanged: jest.fn().mockRejectedValue(new Error('SMTP down')),
      notifyBudgetReady: jest.fn().mockResolvedValue(undefined),
    };
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const useCase = new NotifyStatusChangeUseCase(osRepo, customerRepo, notifier);

    await expect(useCase.execute({ osId: 'os-1' })).resolves.toBeUndefined();
    expect(notifier.notifyStatusChanged).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('GIVEN osRepo throws WHEN execute called THEN error is swallowed and method still resolves', async () => {
    const osRepo = makeOSRepo(baseOS);
    (osRepo.findById as jest.Mock).mockRejectedValue(new Error('DB connection lost'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const useCase = new NotifyStatusChangeUseCase(osRepo, makeCustomerRepo(cpfCustomer), makeNotifier());

    await expect(useCase.execute({ osId: 'os-1' })).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
