import {
  ConsoleNotificationService,
  INotificationLogger,
} from '../../../../src/adapters/services/ConsoleNotificationService';
import { FakeIntegrationFailures } from '../../../support/FakeBusinessMetrics';
import { Customer } from '../../../../src/entities/Customer';
import { ServiceOrder } from '../../../../src/entities/ServiceOrder';

const customer = { id: 'c1', name: 'John', email: 'j@t.com', taxId: '11111111111' } as Customer;
const order = {
  id: 'os1',
  customerId: 'c1',
  vehicleId: 'v1',
  status: 'EXECUTION',
  budgetTotal: 100,
  services: [],
  items: [],
  createdAt: new Date(),
} as ServiceOrder;

function loggerThatWorks(): INotificationLogger {
  return { info: jest.fn() };
}

function loggerThatFails(): INotificationLogger {
  return {
    info: jest.fn(() => {
      throw new Error('transport unavailable');
    }),
  };
}

describe('ConsoleNotificationService', () => {
  let failures: FakeIntegrationFailures;

  beforeEach(() => {
    failures = new FakeIntegrationFailures();
  });

  it('should not count a failure GIVEN the dispatch succeeds WHEN notifying', async () => {
    const service = new ConsoleNotificationService(loggerThatWorks(), failures);

    await service.notifyStatusChanged(customer, order);

    expect(failures.recorded).toHaveLength(0);
  });

  it('should count a failure GIVEN the dispatch throws WHEN notifying a status change', async () => {
    const service = new ConsoleNotificationService(loggerThatFails(), failures);

    await expect(service.notifyStatusChanged(customer, order)).rejects.toThrow();

    expect(failures.recorded).toEqual([{ integration: 'notification', operation: 'status_changed' }]);
  });

  it('should count a failure GIVEN the dispatch throws WHEN notifying a ready budget', async () => {
    const service = new ConsoleNotificationService(loggerThatFails(), failures);

    await expect(service.notifyBudgetReady(customer, order)).rejects.toThrow();

    expect(failures.recorded).toEqual([{ integration: 'notification', operation: 'budget_ready' }]);
  });

  // Behaviour is unchanged -- still best-effort, still caught by the use case.
  // What changes is the failure no longer being invisible.
  it('should rethrow the original error GIVEN the dispatch throws WHEN notifying', async () => {
    const service = new ConsoleNotificationService(loggerThatFails(), failures);

    await expect(service.notifyStatusChanged(customer, order)).rejects.toThrow(
      'transport unavailable',
    );
  });
});
