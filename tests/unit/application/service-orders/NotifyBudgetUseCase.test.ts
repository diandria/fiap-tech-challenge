import { NotifyBudgetUseCase } from '../../../../src/use-cases/service-orders/NotifyBudgetUseCase';
import { INotificationService } from '../../../../src/use-cases/ports/INotificationService';
import { makeOSRepo, baseOS } from '../../fixtures/serviceOrder';
import { makeCustomerRepo, cpfCustomer } from '../../fixtures/customer';

const fakeLogger = () => ({ warn: jest.fn(), error: jest.fn() });

const makeNotifier = (): INotificationService => ({
  notifyStatusChanged: jest.fn().mockResolvedValue(undefined),
  notifyBudgetReady: jest.fn().mockResolvedValue(undefined),
});

describe('NotifyBudgetUseCase', () => {
  it('GIVEN valid osId WHEN execute called THEN calls notifyBudgetReady with customer and OS', async () => {
    const osRepo = makeOSRepo(baseOS);
    const customerRepo = makeCustomerRepo(cpfCustomer);
    const notifier = makeNotifier();
    const useCase = new NotifyBudgetUseCase(osRepo, customerRepo, notifier, fakeLogger());

    await useCase.execute({ osId: 'os-1' });

    expect(customerRepo.findById).toHaveBeenCalledWith(baseOS.customerId);
    expect(notifier.notifyBudgetReady).toHaveBeenCalledTimes(1);
    expect(notifier.notifyBudgetReady).toHaveBeenCalledWith(cpfCustomer, baseOS);
  });

  it('GIVEN OS not found WHEN execute called THEN returns silently without calling notifier', async () => {
    const osRepo = makeOSRepo(null);
    const customerRepo = makeCustomerRepo(cpfCustomer);
    const notifier = makeNotifier();
    const useCase = new NotifyBudgetUseCase(osRepo, customerRepo, notifier, fakeLogger());

    await useCase.execute({ osId: 'missing' });

    expect(notifier.notifyBudgetReady).not.toHaveBeenCalled();
  });

  it('GIVEN customer not found WHEN execute called THEN warns and does not call notifier', async () => {
    const osRepo = makeOSRepo(baseOS);
    const customerRepo = makeCustomerRepo(null);
    const notifier = makeNotifier();
    const log = fakeLogger();
    const useCase = new NotifyBudgetUseCase(osRepo, customerRepo, notifier, log);

    await useCase.execute({ osId: 'os-1' });

    expect(notifier.notifyBudgetReady).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'notification skipped: customer not found',
      expect.objectContaining({ osId: expect.any(String) }),
    );
  });

  it('GIVEN notifier throws WHEN execute called THEN error is swallowed and method still resolves', async () => {
    const osRepo = makeOSRepo(baseOS);
    const customerRepo = makeCustomerRepo(cpfCustomer);
    const notifier: INotificationService = {
      notifyStatusChanged: jest.fn().mockResolvedValue(undefined),
      notifyBudgetReady: jest.fn().mockRejectedValue(new Error('SMTP down')),
    };
    const log = fakeLogger();
    const useCase = new NotifyBudgetUseCase(osRepo, customerRepo, notifier, log);

    await expect(useCase.execute({ osId: 'os-1' })).resolves.toBeUndefined();
    expect(notifier.notifyBudgetReady).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith(
      'notification delivery failed',
      expect.objectContaining({ osId: expect.any(String) }),
    );
  });

  it('GIVEN osRepo throws WHEN execute called THEN error is swallowed and method still resolves', async () => {
    const osRepo = makeOSRepo(baseOS);
    (osRepo.findById as jest.Mock).mockRejectedValue(new Error('DB connection lost'));
    const log = fakeLogger();
    const useCase = new NotifyBudgetUseCase(osRepo, makeCustomerRepo(cpfCustomer), makeNotifier(), log);

    await expect(useCase.execute({ osId: 'os-1' })).resolves.toBeUndefined();
    expect(log.error).toHaveBeenCalledWith(
      'notification delivery failed',
      expect.objectContaining({ osId: expect.any(String) }),
    );
  });
});
