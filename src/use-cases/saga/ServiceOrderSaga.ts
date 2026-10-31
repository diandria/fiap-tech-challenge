import { OSStatus, ServiceOrder } from '../../entities/ServiceOrder';
import { NotFoundError } from '../../entities/errors/AppError';
import { assertTransition } from '../../entities/serviceOrderStateMachine';
import { IUnitOfWork, TransactionalRepositories } from '../ports/IUnitOfWork';
import { IServiceRepository } from '../ports/IServiceRepository';
import { ICustomerRepository } from '../ports/ICustomerRepository';
import { IStatusChangeNotifier } from '../ports/IStatusChangeNotifier';
import { ILogger } from '../ports/ILogger';
import { IServiceOrderSaga } from '../ports/input/IServiceOrderSaga';
import { GenerateBudgetCommand, SagaReply, SagaReplyResult, SagaReplyType } from './messages';
import { buildBudgetLines } from './buildBudgetLines';
import { Item } from '../../entities/Item';
import { Service } from '../../entities/Service';

/**
 * The status each reply expects to find, the same table as ADR-014. With a
 * FIFO queue per order, any other status means a repeat that came back after
 * the deduplication window, and the reply is dropped.
 */
const EXPECTED_STATUS: Record<SagaReplyType, OSStatus[]> = {
  DiagnosisStarted: ['RECEIVED'],
  DiagnosisCompleted: ['DIAGNOSIS'],
};

/**
 * The orchestrator of the service order saga: the one place that knows the
 * whole flow. Every reply is handled the same way, in a single unit of work:
 * record the message id, read the order again, check its status, apply the
 * effect with the version that was read. Customers hear about the change only
 * after the commit.
 */
export class ServiceOrderSaga implements IServiceOrderSaga {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly services: IServiceRepository,
    private readonly customers: ICustomerRepository,
    private readonly notifyStatusChange: IStatusChangeNotifier,
    private readonly logger: ILogger,
  ) {}

  async handle(reply: SagaReply): Promise<SagaReplyResult> {
    const result = await this.unitOfWork.run(async (repositories): Promise<SagaReplyResult> => {
      if (!(await repositories.processedMessages.markProcessed(reply.messageId, reply.type))) {
        return { outcome: 'duplicate' };
      }

      const order = await repositories.serviceOrders.findById(reply.serviceOrderId);
      if (!order || !EXPECTED_STATUS[reply.type].includes(order.status)) {
        this.logger.warn('saga reply ignored: the order is not in the status it expects', {
          serviceOrderId: reply.serviceOrderId,
          replyType: reply.type,
          status: order?.status ?? null,
        });
        return { outcome: 'ignored' };
      }

      return { outcome: 'applied', serviceOrder: await this.apply(reply, order, repositories) };
    });

    if (result.outcome === 'applied') {
      await this.notifyStatusChange.execute({ osId: reply.serviceOrderId });
    }
    return result;
  }

  private apply(reply: SagaReply, order: ServiceOrder, repositories: TransactionalRepositories): Promise<ServiceOrder> {
    switch (reply.type) {
      case 'DiagnosisStarted':
        return this.diagnosisStarted(order, repositories);
      case 'DiagnosisCompleted':
        return this.diagnosisCompleted(order, repositories);
    }
  }

  private diagnosisStarted(order: ServiceOrder, { serviceOrders }: TransactionalRepositories): Promise<ServiceOrder> {
    return this.moveTo(order, 'DIAGNOSIS', serviceOrders);
  }

  /**
   * The order moves to WAITING_APPROVAL before the budget exists, on purpose:
   * items and services can only change during DIAGNOSIS, so nothing added from
   * here on can be left out of the budget the Billing Service is computing.
   */
  private async diagnosisCompleted(order: ServiceOrder, repositories: TransactionalRepositories): Promise<ServiceOrder> {
    const command = await this.budgetCommandFor(order, repositories);
    const updated = await this.moveTo(order, 'WAITING_APPROVAL', repositories.serviceOrders);
    await repositories.outbox.add({
      destination: 'billing-commands',
      type: 'GenerateBudget',
      serviceOrderId: order.id,
      payload: { ...command },
    });
    return updated;
  }

  private async budgetCommandFor(order: ServiceOrder, { items }: TransactionalRepositories): Promise<GenerateBudgetCommand> {
    const customer = await this.customers.findById(order.customerId);
    if (!customer) throw new NotFoundError(`Customer ${order.customerId}`);

    const catalogServices = await Promise.all(order.services.map(({ serviceId }) => this.services.findById(serviceId)));
    const catalogItems = await Promise.all(order.items.map(({ itemId }) => items.findById(itemId)));

    return {
      customer: { id: customer.id, name: customer.name, email: customer.email },
      lines: buildBudgetLines(
        order,
        catalogServices.filter((service): service is Service => service !== null),
        catalogItems.filter((item): item is Item => item !== null),
      ),
    };
  }

  /** Changes the status with the version that was read, so a concurrent write fails instead of being overwritten. */
  private async moveTo(
    order: ServiceOrder,
    status: OSStatus,
    serviceOrders: TransactionalRepositories['serviceOrders'],
    changes: Partial<Omit<ServiceOrder, 'id' | 'version' | 'status'>> = {},
  ): Promise<ServiceOrder> {
    assertTransition(order.status, status);
    const updated = await serviceOrders.update(order.id, { ...changes, status }, { expectedVersion: order.version });
    if (!updated) throw new NotFoundError('Service order');
    return updated;
  }
}
