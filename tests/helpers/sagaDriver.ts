import { randomUUID } from 'node:crypto';
import { OSStatus } from '../../src/entities/ServiceOrder';
import { PrismaUnitOfWork } from '../../src/adapters/gateways/PrismaUnitOfWork';
import { PostgresServiceRepository } from '../../src/adapters/gateways/PostgresServiceRepository';
import { PostgresCustomerRepository } from '../../src/adapters/gateways/PostgresCustomerRepository';
import { PostgresServiceOrderRepository } from '../../src/adapters/gateways/PostgresServiceOrderRepository';
import { ConsoleNotificationService } from '../../src/adapters/services/ConsoleNotificationService';
import { PinoLoggerAdapter } from '../../src/adapters/logging/PinoLoggerAdapter';
import { PrometheusIntegrationFailures } from '../../src/frameworks/metrics/PrometheusIntegrationFailures';
import { logger } from '../../src/frameworks/logging/logger';
import { NotifyStatusChangeUseCase } from '../../src/use-cases/service-orders/NotifyStatusChangeUseCase';
import { ServiceOrderSaga } from '../../src/use-cases/saga/ServiceOrderSaga';
import { SagaReplyType } from '../../src/use-cases/saga/messages';
import { prisma } from './testSetup';

/** The reply that moves an order out of each status on the way to FINISHED. */
const NEXT_STEP: Partial<Record<OSStatus, SagaReplyType>> = {
  RECEIVED: 'DiagnosisStarted',
  DIAGNOSIS: 'DiagnosisCompleted',
  WAITING_APPROVAL: 'BudgetApproved',
  APPROVED: 'PaymentConfirmed',
  PAID: 'RepairStarted',
  EXECUTION: 'RepairCompleted',
};

/** The saga as the application wires it, customer notices included, on the test database. */
export function sagaOnTheTestDatabase(): ServiceOrderSaga {
  const appLogger = new PinoLoggerAdapter(logger);
  const customers = new PostgresCustomerRepository(prisma);
  const notifyStatusChange = new NotifyStatusChangeUseCase(
    new PostgresServiceOrderRepository(prisma),
    customers,
    new ConsoleNotificationService(logger, new PrometheusIntegrationFailures()),
    appLogger,
  );
  return new ServiceOrderSaga(
    new PrismaUnitOfWork(prisma, { currentTraceparent: () => undefined }),
    new PostgresServiceRepository(prisma),
    customers,
    notifyStatusChange,
    appLogger,
  );
}

/** The total the Billing Service would compute from the GenerateBudget the OS sent. */
async function budgetTotalFor(serviceOrderId: string): Promise<number> {
  const command = await prisma.outboxMessage.findFirstOrThrow({
    where: { serviceOrderId, type: 'GenerateBudget' },
    orderBy: { createdAt: 'desc' },
  });
  const { lines } = command.payload as { lines: { unitPrice: number; quantity: number }[] };
  return lines.reduce((total, line) => total + line.unitPrice * line.quantity, 0);
}

async function deliver(type: SagaReplyType, serviceOrderId: string, payload: Record<string, unknown> = {}): Promise<void> {
  const result = await sagaOnTheTestDatabase().handle({ messageId: randomUUID(), type, serviceOrderId, payload });
  if (result.outcome !== 'applied') {
    throw new Error(`${type} was ${result.outcome} for order ${serviceOrderId}`);
  }
}

/**
 * Takes an order to a status the way production does since the saga took
 * over: by delivering, in order, the replies the Billing and Execution
 * services would send. Integration tests reach intermediate statuses with it
 * instead of a manual transition that no longer exists.
 */
export async function driveOrderTo(serviceOrderId: string, target: OSStatus): Promise<void> {
  for (;;) {
    const { status } = await prisma.serviceOrder.findUniqueOrThrow({ where: { id: serviceOrderId } });
    if (status === target) return;

    if (target === 'REJECTED' && status === 'WAITING_APPROVAL') {
      await deliver('BudgetRejected', serviceOrderId, { budgetId: randomUUID() });
      continue;
    }

    const reply = NEXT_STEP[status];
    if (!reply) throw new Error(`No saga path from ${status} to ${target}`);
    await deliver(reply, serviceOrderId);

    // The Billing Service answers a GenerateBudget with the budget total.
    if (reply === 'DiagnosisCompleted') {
      await deliver('BudgetGenerated', serviceOrderId, { budgetId: randomUUID(), total: await budgetTotalFor(serviceOrderId) });
    }
  }
}
