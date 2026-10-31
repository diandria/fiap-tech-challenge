import { OSStatus, ServiceOrder } from '../../entities/ServiceOrder';
import { NotFoundError, ValidationError } from '../../entities/errors/AppError';
import { assertTransition } from '../../entities/serviceOrderStateMachine';
import { IUnitOfWork, TransactionalRepositories } from '../ports/IUnitOfWork';
import { IServiceRepository } from '../ports/IServiceRepository';
import { ICustomerRepository } from '../ports/ICustomerRepository';
import { IStatusChangeNotifier } from '../ports/IStatusChangeNotifier';
import { ILogger } from '../ports/ILogger';
import { IServiceOrderSaga } from '../ports/input/IServiceOrderSaga';
import {
  CompensationReason,
  EnqueueRepairCommand,
  FailedSagaCommand,
  GenerateBudgetCommand,
  SagaCommandType,
  SagaReply,
  SagaReplyResult,
  SagaReplyType,
} from './messages';
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
  BudgetGenerated: ['WAITING_APPROVAL'],
  BudgetApproved: ['WAITING_APPROVAL'],
  BudgetRejected: ['WAITING_APPROVAL'],
  PaymentConfirmed: ['APPROVED'],
  PaymentFailed: ['APPROVED'],
  RepairStarted: ['PAID'],
  RepairCompleted: ['EXECUTION'],
  // Confirmations of a compensation. The budget is only cancelled when a
  // payment fails, so its confirmation only fits a CANCELLED order.
  ExecutionCancelled: ['REJECTED', 'CANCELLED'],
  BudgetCancelled: ['CANCELLED'],
};

/** Replies that undo the earlier steps, and the reason the compensation commands carry. */
const COMPENSATION: Partial<Record<SagaReplyType, CompensationReason>> = {
  BudgetRejected: 'BUDGET_REJECTED',
  PaymentFailed: 'PAYMENT_FAILED',
};

/**
 * What a dead command means, by the status the order should still be in.
 * Before the payment is confirmed the step is undone like a refusal would be;
 * from the repair on, and for any compensation command, nothing is undone:
 * the failure is reported for a person to look at. A compensation that fails
 * never starts another compensation, which could loop.
 */
const FAILED_COMMAND: Record<SagaCommandType, { expected: OSStatus[] | 'any'; cancel: ('execution' | 'budget')[] | 'report' }> = {
  EnqueueDiagnosis: { expected: ['RECEIVED'], cancel: [] },
  GenerateBudget: { expected: ['WAITING_APPROVAL'], cancel: ['execution'] },
  RequestPayment: { expected: ['APPROVED'], cancel: ['execution', 'budget'] },
  EnqueueRepair: { expected: ['PAID'], cancel: 'report' },
  CancelExecution: { expected: 'any', cancel: 'report' },
  CancelBudget: { expected: 'any', cancel: 'report' },
};

interface SagaMessage {
  messageId: string;
  type: string;
  serviceOrderId: string;
}

type Effect = Required<Pick<SagaReplyResult, 'serviceOrder'>> & Pick<SagaReplyResult, 'compensation' | 'stuck'>;

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
    private readonly now: () => Date = () => new Date(),
  ) {}

  handle(reply: SagaReply): Promise<SagaReplyResult> {
    return this.process(reply, EXPECTED_STATUS[reply.type], async (order, repositories) => {
      const compensation = COMPENSATION[reply.type];
      return { serviceOrder: await this.apply(reply, order, repositories), ...(compensation && { compensation }) };
    });
  }

  handleFailedCommand(command: FailedSagaCommand): Promise<SagaReplyResult> {
    const { expected, cancel } = FAILED_COMMAND[command.type];
    return this.process(command, expected, async (order, repositories) => {
      if (cancel === 'report') return this.reportStuck(order, command);
      return { serviceOrder: await this.stepFailed(order, cancel, repositories), compensation: 'STEP_FAILED' };
    });
  }

  /**
   * The algorithm every message follows, in one unit of work: record the
   * message id, read the order again, check its status, apply the effect.
   */
  private async process(
    message: SagaMessage,
    expected: OSStatus[] | 'any',
    effect: (order: ServiceOrder, repositories: TransactionalRepositories) => Promise<Effect>,
  ): Promise<SagaReplyResult> {
    let statusChanged = false;
    const result = await this.unitOfWork.run(async (repositories): Promise<SagaReplyResult> => {
      if (!(await repositories.processedMessages.markProcessed(message.messageId, message.type))) {
        return { outcome: 'duplicate' };
      }

      const order = await repositories.serviceOrders.findById(message.serviceOrderId);
      if (!order || (expected !== 'any' && !expected.includes(order.status))) {
        this.logger.warn('saga message ignored: the order is not in the status it expects', {
          serviceOrderId: message.serviceOrderId,
          messageType: message.type,
          status: order?.status ?? null,
        });
        return { outcome: 'ignored' };
      }

      const applied = await effect(order, repositories);
      statusChanged = applied.serviceOrder.status !== order.status;
      return { outcome: 'applied', ...applied, ...(statusChanged && { statusChanged: true as const }) };
    });

    // Only a new status is news to the customer; a stored total is not.
    if (statusChanged) {
      await this.notifyStatusChange.execute({ osId: message.serviceOrderId });
    }
    return result;
  }

  private apply(reply: SagaReply, order: ServiceOrder, repositories: TransactionalRepositories): Promise<ServiceOrder> {
    switch (reply.type) {
      case 'DiagnosisStarted':
        return this.diagnosisStarted(order, repositories);
      case 'DiagnosisCompleted':
        return this.diagnosisCompleted(order, repositories);
      case 'BudgetGenerated':
        return this.budgetGenerated(order, reply, repositories);
      case 'BudgetApproved':
        return this.budgetApproved(order, repositories);
      case 'BudgetRejected':
        return this.budgetRejected(order, repositories);
      case 'PaymentConfirmed':
        return this.paymentConfirmed(order, repositories);
      case 'PaymentFailed':
        return this.paymentFailed(order, repositories);
      case 'RepairStarted':
        return this.repairStarted(order, repositories);
      case 'RepairCompleted':
        return this.repairCompleted(order, repositories);
      case 'ExecutionCancelled':
      case 'BudgetCancelled':
        return this.compensationConfirmed(order, reply);
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

  /** The Billing Service computed the budget; the order keeps its total for the status queries. */
  private async budgetGenerated(order: ServiceOrder, reply: SagaReply, { serviceOrders }: TransactionalRepositories): Promise<ServiceOrder> {
    const { total } = reply.payload;
    if (typeof total !== 'number' || !Number.isFinite(total)) {
      throw new ValidationError('The budget total must be a number');
    }
    return this.save(order, { budgetTotal: total }, serviceOrders);
  }

  private async budgetApproved(order: ServiceOrder, repositories: TransactionalRepositories): Promise<ServiceOrder> {
    const updated = await this.moveTo(order, 'APPROVED', repositories.serviceOrders);
    await repositories.outbox.add({ destination: 'billing-commands', type: 'RequestPayment', serviceOrderId: order.id, payload: {} });
    return updated;
  }

  /**
   * Compensates the opening of the order and the diagnosis. The local undo
   * (stock released, order rejected) and the request to the Execution Service
   * commit together: there is no state where the order is rejected and the
   * mechanic's queue never hears about it.
   */
  private async budgetRejected(order: ServiceOrder, repositories: TransactionalRepositories): Promise<ServiceOrder> {
    await this.releaseReservations(order, repositories);
    const updated = await this.moveTo(order, 'REJECTED', repositories.serviceOrders);
    await repositories.outbox.add({
      destination: 'execution-commands',
      type: 'CancelExecution',
      serviceOrderId: order.id,
      payload: { reason: COMPENSATION.BudgetRejected },
    });
    return updated;
  }

  /**
   * The point of no return: from here on there is no compensation. The
   * reserved parts leave the stock, and the repair goes to the mechanic's
   * queue. A consumption that fails throws, so the reply comes back until it
   * succeeds or lands in the dead-letter queue and raises an alert.
   */
  private async paymentConfirmed(order: ServiceOrder, repositories: TransactionalRepositories): Promise<ServiceOrder> {
    for (const { itemId, quantity } of order.items) {
      if (!(await repositories.items.consume(itemId, quantity))) {
        throw new ValidationError(`Cannot consume ${quantity} reserved units of item ${itemId}`);
      }
    }
    const command = await this.repairCommandFor(order);
    const updated = await this.moveTo(order, 'PAID', repositories.serviceOrders);
    await repositories.outbox.add({
      destination: 'execution-commands',
      type: 'EnqueueRepair',
      serviceOrderId: order.id,
      payload: { ...command },
    });
    return updated;
  }

  /**
   * Compensates every step before payment: the stock reservation here, the
   * queue entry in the Execution Service and the budget in the Billing
   * Service, all requested in the same transaction as the cancellation.
   */
  private async paymentFailed(order: ServiceOrder, repositories: TransactionalRepositories): Promise<ServiceOrder> {
    await this.releaseReservations(order, repositories);
    const updated = await this.moveTo(order, 'CANCELLED', repositories.serviceOrders);
    const payload = { reason: COMPENSATION.PaymentFailed };
    await repositories.outbox.add({ destination: 'execution-commands', type: 'CancelExecution', serviceOrderId: order.id, payload });
    await repositories.outbox.add({ destination: 'billing-commands', type: 'CancelBudget', serviceOrderId: order.id, payload });
    return updated;
  }

  private repairStarted(order: ServiceOrder, { serviceOrders }: TransactionalRepositories): Promise<ServiceOrder> {
    return this.moveTo(order, 'EXECUTION', serviceOrders, { startedAt: this.now() });
  }

  /** The end of the saga. Delivery to the customer stays a manual step for the staff. */
  private repairCompleted(order: ServiceOrder, { serviceOrders }: TransactionalRepositories): Promise<ServiceOrder> {
    return this.moveTo(order, 'FINISHED', serviceOrders, { finishedAt: this.now() });
  }

  /**
   * A participant confirms it undid its step. Nothing changes here, but the
   * confirmation is consumed and recorded, so the saga closes visibly in the
   * logs and the trace, and a missing one shows up as a message stuck in the
   * dead-letter queue.
   */
  private async compensationConfirmed(order: ServiceOrder, reply: SagaReply): Promise<ServiceOrder> {
    this.logger.info('saga compensation confirmed', {
      serviceOrderId: order.id,
      messageType: reply.type,
      status: order.status,
    });
    return order;
  }

  /**
   * A participant could not process a command five times. The orchestrator is
   * the one that knows which steps came before, so it undoes them: the stock
   * reservation here, and the steps already done by the other services.
   */
  private async stepFailed(
    order: ServiceOrder,
    cancel: ('execution' | 'budget')[],
    repositories: TransactionalRepositories,
  ): Promise<ServiceOrder> {
    await this.releaseReservations(order, repositories);
    const updated = await this.moveTo(order, 'CANCELLED', repositories.serviceOrders);
    const payload = { reason: 'STEP_FAILED' };
    if (cancel.includes('execution')) {
      await repositories.outbox.add({ destination: 'execution-commands', type: 'CancelExecution', serviceOrderId: order.id, payload });
    }
    if (cancel.includes('budget')) {
      await repositories.outbox.add({ destination: 'billing-commands', type: 'CancelBudget', serviceOrderId: order.id, payload });
    }
    return updated;
  }

  /**
   * Past the payment, or for a compensation command, there is nothing left to
   * undo. The dead message is deleted from its queue once handled, so this log
   * line, with everything the message said, becomes its record.
   */
  private async reportStuck(order: ServiceOrder, command: FailedSagaCommand): Promise<Effect> {
    this.logger.error('saga step failed after its retries and cannot be compensated', {
      serviceOrderId: order.id,
      messageType: command.type,
      messageId: command.messageId,
      status: order.status,
    });
    return { serviceOrder: order, stuck: true };
  }

  private async repairCommandFor(order: ServiceOrder): Promise<EnqueueRepairCommand> {
    const tasks = await Promise.all(order.services.map(async ({ serviceId }) => {
      const service = await this.services.findById(serviceId);
      if (!service) throw new NotFoundError(`Service ${serviceId}`);
      return { serviceId, name: service.name };
    }));
    return { tasks };
  }

  /** A release that does not fit the reservation means the stock is inconsistent; the reply must fail. */
  private async releaseReservations(order: ServiceOrder, { items }: TransactionalRepositories): Promise<void> {
    for (const { itemId, quantity } of order.items) {
      if (!(await items.release(itemId, quantity))) {
        throw new ValidationError(`Cannot release ${quantity} reserved units of item ${itemId}`);
      }
    }
  }

  /** Moves the order to a new status, if the state machine allows it. */
  private async moveTo(
    order: ServiceOrder,
    status: OSStatus,
    serviceOrders: TransactionalRepositories['serviceOrders'],
    changes: Partial<Omit<ServiceOrder, 'id' | 'version' | 'status'>> = {},
  ): Promise<ServiceOrder> {
    assertTransition(order.status, status);
    return this.save(order, { ...changes, status }, serviceOrders);
  }

  /** Writes with the version that was read, so a concurrent write fails instead of being overwritten. */
  private async save(
    order: ServiceOrder,
    changes: Partial<Omit<ServiceOrder, 'id' | 'version'>>,
    serviceOrders: TransactionalRepositories['serviceOrders'],
  ): Promise<ServiceOrder> {
    const updated = await serviceOrders.update(order.id, changes, { expectedVersion: order.version });
    if (!updated) throw new NotFoundError('Service order');
    return updated;
  }
}
