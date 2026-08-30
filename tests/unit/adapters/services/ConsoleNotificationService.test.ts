import { Logger } from 'pino';
import { ConsoleNotificationService } from '../../../../src/adapters/services/ConsoleNotificationService';
import { integrationFailures } from '../../../../src/frameworks/metrics/integrationMetrics';
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

function loggerThatWorks(): Logger {
  return { info: jest.fn() } as unknown as Logger;
}

function loggerThatFails(): Logger {
  return {
    info: jest.fn(() => {
      throw new Error('transporte indisponivel');
    }),
  } as unknown as Logger;
}

async function labelsOf(): Promise<Record<string, string | number>[]> {
  return (await integrationFailures.get()).values.map((v) => v.labels);
}

describe('ConsoleNotificationService', () => {
  beforeEach(() => integrationFailures.reset());

  it('should not count a failure GIVEN the dispatch succeeds WHEN notifying', async () => {
    const service = new ConsoleNotificationService(loggerThatWorks());

    await service.notifyStatusChanged(customer, order);

    expect(await labelsOf()).toHaveLength(0);
  });

  it('should count a failure GIVEN the dispatch throws WHEN notifying a status change', async () => {
    const service = new ConsoleNotificationService(loggerThatFails());

    await expect(service.notifyStatusChanged(customer, order)).rejects.toThrow();

    expect(await labelsOf()).toEqual([{ integration: 'notification', operation: 'status_changed' }]);
  });

  it('should count a failure GIVEN the dispatch throws WHEN notifying a ready budget', async () => {
    const service = new ConsoleNotificationService(loggerThatFails());

    await expect(service.notifyBudgetReady(customer, order)).rejects.toThrow();

    expect(await labelsOf()).toEqual([{ integration: 'notification', operation: 'budget_ready' }]);
  });

  // O comportamento nao muda: a notificacao continua best-effort e o erro segue
  // subindo para o catch do caso de uso, que ja decidiu nao reverter a
  // transicao de status. O que muda e a falha deixar de ser invisivel.
  it('should rethrow the original error GIVEN the dispatch throws WHEN notifying', async () => {
    const service = new ConsoleNotificationService(loggerThatFails());

    await expect(service.notifyStatusChanged(customer, order)).rejects.toThrow(
      'transporte indisponivel',
    );
  });
});
