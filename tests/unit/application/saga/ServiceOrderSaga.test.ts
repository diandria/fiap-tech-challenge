import { ServiceOrderSaga } from '../../../../src/use-cases/saga/ServiceOrderSaga';
import { ServiceOrder } from '../../../../src/entities/ServiceOrder';
import { IUnitOfWork, TransactionalRepositories } from '../../../../src/use-cases/ports/IUnitOfWork';
import { IItemRepository } from '../../../../src/use-cases/ports/IItemRepository';
import { makeOSRepo, receivedOS, baseOS, waitingApprovalOS, approvedOS, executionOS } from '../../fixtures/serviceOrder';
import { makeItemRepo, stockedItem, reservedItem } from '../../fixtures/item';
import { makeServiceRepo, baseService } from '../../fixtures/service';
import { makeCustomerRepo, cpfCustomer } from '../../fixtures/customer';
import { sagaReply } from '../../../support/sagaReplies';

const NOW = new Date('2026-10-31T15:00:00.000Z');

function setup(order: ServiceOrder | null, options: { firstDelivery?: boolean; items?: IItemRepository } = {}) {
  const events: string[] = [];
  const repositories: TransactionalRepositories = {
    serviceOrders: makeOSRepo(order),
    items: options.items ?? makeItemRepo(),
    outbox: { add: jest.fn() },
    processedMessages: { markProcessed: jest.fn().mockResolvedValue(options.firstDelivery ?? true) },
  };
  const unitOfWork: IUnitOfWork & { run: jest.Mock } = {
    run: jest.fn(async (work) => {
      const result = await work(repositories);
      events.push('commit');
      return result;
    }),
  };
  const notifier = { execute: jest.fn(async () => { events.push('notify'); }) };
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const saga = new ServiceOrderSaga(unitOfWork, makeServiceRepo(), makeCustomerRepo(), notifier, logger, () => NOW);
  return { saga, repositories, unitOfWork, notifier, logger, events };
}

describe('ServiceOrderSaga', () => {
  it('moves RECEIVED to DIAGNOSIS on DiagnosisStarted', async () => {
    const { saga, repositories } = setup(receivedOS);

    const result = await saga.handle(sagaReply('DiagnosisStarted', receivedOS.id));

    expect(repositories.serviceOrders.update).toHaveBeenCalledWith(receivedOS.id, { status: 'DIAGNOSIS' }, { expectedVersion: receivedOS.version });
    expect(result).toMatchObject({ outcome: 'applied', serviceOrder: { status: 'DIAGNOSIS' } });
  });

  it('moves DIAGNOSIS to WAITING_APPROVAL and asks billing for a budget on DiagnosisCompleted', async () => {
    const diagnosing = { ...baseOS, services: [{ serviceId: baseService.id }], items: [{ itemId: stockedItem.id, quantity: 2 }] };
    const { saga, repositories } = setup(diagnosing);

    const result = await saga.handle(sagaReply('DiagnosisCompleted', diagnosing.id));

    expect(result.outcome).toBe('applied');
    expect(repositories.serviceOrders.update).toHaveBeenCalledWith(diagnosing.id, { status: 'WAITING_APPROVAL' }, { expectedVersion: diagnosing.version });
    expect(repositories.outbox.add).toHaveBeenCalledWith({
      destination: 'billing-commands',
      type: 'GenerateBudget',
      serviceOrderId: diagnosing.id,
      payload: {
        customer: { id: cpfCustomer.id, name: cpfCustomer.name, email: cpfCustomer.email },
        lines: [
          { kind: 'SERVICE', referenceId: baseService.id, description: baseService.name, unitPrice: baseService.price, quantity: 1 },
          { kind: 'ITEM', referenceId: stockedItem.id, description: stockedItem.name, unitPrice: stockedItem.price, quantity: 2 },
        ],
      },
    });
  });

  it('records the reply as processed in the same unit of work as the effect', async () => {
    const { saga, repositories, unitOfWork } = setup(receivedOS);
    const reply = sagaReply('DiagnosisStarted', receivedOS.id);

    await saga.handle(reply);

    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
    expect(repositories.processedMessages.markProcessed).toHaveBeenCalledWith(reply.messageId, 'DiagnosisStarted');
  });

  it('returns duplicate and changes nothing when the message was already processed', async () => {
    const { saga, repositories, notifier } = setup(receivedOS, { firstDelivery: false });

    const result = await saga.handle(sagaReply('DiagnosisStarted', receivedOS.id));

    expect(result).toEqual({ outcome: 'duplicate' });
    expect(repositories.serviceOrders.findById).not.toHaveBeenCalled();
    expect(repositories.serviceOrders.update).not.toHaveBeenCalled();
    expect(notifier.execute).not.toHaveBeenCalled();
  });

  it('returns ignored when the order is not in the expected status', async () => {
    const { saga, repositories, logger, notifier } = setup(baseOS);

    const result = await saga.handle(sagaReply('DiagnosisStarted', baseOS.id));

    expect(result).toEqual({ outcome: 'ignored' });
    expect(repositories.serviceOrders.update).not.toHaveBeenCalled();
    expect(notifier.execute).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      serviceOrderId: baseOS.id, replyType: 'DiagnosisStarted', status: 'DIAGNOSIS',
    }));
  });

  it('returns ignored when the order does not exist', async () => {
    const { saga, logger } = setup(null);

    expect(await saga.handle(sagaReply('DiagnosisStarted', 'os-missing'))).toEqual({ outcome: 'ignored' });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('notifies the status change only after the unit of work commits', async () => {
    const { saga, notifier, events } = setup(receivedOS);

    await saga.handle(sagaReply('DiagnosisStarted', receivedOS.id));

    expect(notifier.execute).toHaveBeenCalledWith({ osId: receivedOS.id });
    expect(events).toEqual(['commit', 'notify']);
  });

  it('stores the budget total from BudgetGenerated and keeps the status', async () => {
    const { saga, repositories, notifier } = setup(waitingApprovalOS);

    const result = await saga.handle(sagaReply('BudgetGenerated', waitingApprovalOS.id, { budgetId: 'b-1', total: 180 }));

    expect(result.outcome).toBe('applied');
    expect(repositories.serviceOrders.update).toHaveBeenCalledWith(waitingApprovalOS.id, { budgetTotal: 180 }, { expectedVersion: waitingApprovalOS.version });
    expect(repositories.outbox.add).not.toHaveBeenCalled();
    expect(notifier.execute).not.toHaveBeenCalled();
  });

  it('refuses a budget reply whose total is not a number', async () => {
    const { saga, repositories } = setup(waitingApprovalOS);

    await expect(saga.handle(sagaReply('BudgetGenerated', waitingApprovalOS.id, { budgetId: 'b-1' }))).rejects.toThrow('total must be a number');
    expect(repositories.serviceOrders.update).not.toHaveBeenCalled();
  });

  it('approves the order and requests payment on BudgetApproved', async () => {
    const { saga, repositories, notifier } = setup(waitingApprovalOS);

    const result = await saga.handle(sagaReply('BudgetApproved', waitingApprovalOS.id, { budgetId: 'b-1' }));

    expect(result).toMatchObject({ outcome: 'applied', serviceOrder: { status: 'APPROVED' } });
    expect(repositories.serviceOrders.update).toHaveBeenCalledWith(waitingApprovalOS.id, { status: 'APPROVED' }, { expectedVersion: waitingApprovalOS.version });
    expect(repositories.outbox.add).toHaveBeenCalledWith({
      destination: 'billing-commands',
      type: 'RequestPayment',
      serviceOrderId: waitingApprovalOS.id,
      payload: {},
    });
    expect(notifier.execute).toHaveBeenCalledWith({ osId: waitingApprovalOS.id });
  });

  it('releases every reserved item, rejects the order and cancels execution on BudgetRejected', async () => {
    const order = { ...waitingApprovalOS, items: [{ itemId: 'i-1', quantity: 2 }, { itemId: 'i-2', quantity: 1 }] };
    const { saga, repositories } = setup(order, { items: makeItemRepo(reservedItem) });

    const result = await saga.handle(sagaReply('BudgetRejected', order.id, { budgetId: 'b-1' }));

    expect(result).toMatchObject({ outcome: 'applied', compensation: 'BUDGET_REJECTED', serviceOrder: { status: 'REJECTED' } });
    expect(repositories.items.release).toHaveBeenNthCalledWith(1, 'i-1', 2);
    expect(repositories.items.release).toHaveBeenNthCalledWith(2, 'i-2', 1);
    expect(repositories.serviceOrders.update).toHaveBeenCalledWith(order.id, { status: 'REJECTED' }, { expectedVersion: order.version });
    expect(repositories.outbox.add).toHaveBeenCalledWith({
      destination: 'execution-commands',
      type: 'CancelExecution',
      serviceOrderId: order.id,
      payload: { reason: 'BUDGET_REJECTED' },
    });
  });

  it('fails without changes when a release is refused', async () => {
    const items = makeItemRepo(reservedItem);
    (items.release as jest.Mock).mockResolvedValueOnce(false);
    const { saga, repositories, notifier } = setup(waitingApprovalOS, { items });

    await expect(saga.handle(sagaReply('BudgetRejected', waitingApprovalOS.id, { budgetId: 'b-1' }))).rejects.toThrow('i-1');

    expect(repositories.serviceOrders.update).not.toHaveBeenCalled();
    expect(repositories.outbox.add).not.toHaveBeenCalled();
    expect(notifier.execute).not.toHaveBeenCalled();
  });

  it('consumes reserved stock, marks PAID and enqueues the repair with task names on PaymentConfirmed', async () => {
    const order = { ...approvedOS, services: [{ serviceId: baseService.id }], items: [{ itemId: 'i-1', quantity: 2 }] };
    const { saga, repositories } = setup(order, { items: makeItemRepo(reservedItem) });

    const result = await saga.handle(sagaReply('PaymentConfirmed', order.id, { paymentId: 'p-1', amount: 200 }));

    expect(result).toMatchObject({ outcome: 'applied', serviceOrder: { status: 'PAID' } });
    expect(result.compensation).toBeUndefined();
    expect(repositories.items.consume).toHaveBeenCalledWith('i-1', 2);
    expect(repositories.serviceOrders.update).toHaveBeenCalledWith(order.id, { status: 'PAID' }, { expectedVersion: order.version });
    expect(repositories.outbox.add).toHaveBeenCalledWith({
      destination: 'execution-commands',
      type: 'EnqueueRepair',
      serviceOrderId: order.id,
      payload: { tasks: [{ serviceId: baseService.id, name: baseService.name }] },
    });
  });

  it('fails without changes when reserved stock cannot be consumed', async () => {
    const items = makeItemRepo(reservedItem);
    (items.consume as jest.Mock).mockResolvedValueOnce(false);
    const { saga, repositories } = setup(approvedOS, { items });

    await expect(saga.handle(sagaReply('PaymentConfirmed', approvedOS.id, { paymentId: 'p-1', amount: 200 }))).rejects.toThrow('i-1');

    expect(repositories.serviceOrders.update).not.toHaveBeenCalled();
    expect(repositories.outbox.add).not.toHaveBeenCalled();
  });

  it('releases stock, cancels the order and asks execution and billing to compensate on PaymentFailed', async () => {
    const { saga, repositories } = setup(approvedOS, { items: makeItemRepo(reservedItem) });

    const result = await saga.handle(sagaReply('PaymentFailed', approvedOS.id, { paymentId: 'p-1', reason: 'cc_rejected_other_reason' }));

    expect(result).toMatchObject({ outcome: 'applied', compensation: 'PAYMENT_FAILED', serviceOrder: { status: 'CANCELLED' } });
    expect(repositories.items.release).toHaveBeenCalledWith('i-1', 2);
    expect(repositories.outbox.add).toHaveBeenCalledWith({
      destination: 'execution-commands', type: 'CancelExecution', serviceOrderId: approvedOS.id, payload: { reason: 'PAYMENT_FAILED' },
    });
    expect(repositories.outbox.add).toHaveBeenCalledWith({
      destination: 'billing-commands', type: 'CancelBudget', serviceOrderId: approvedOS.id, payload: { reason: 'PAYMENT_FAILED' },
    });
  });

  it('moves PAID to EXECUTION and records startedAt on RepairStarted', async () => {
    const paid = { ...approvedOS, status: 'PAID' as const };
    const { saga, repositories, notifier } = setup(paid);

    const result = await saga.handle(sagaReply('RepairStarted', paid.id));

    expect(result).toMatchObject({ outcome: 'applied', serviceOrder: { status: 'EXECUTION' } });
    expect(repositories.serviceOrders.update).toHaveBeenCalledWith(paid.id, { status: 'EXECUTION', startedAt: NOW }, { expectedVersion: paid.version });
    expect(notifier.execute).toHaveBeenCalledWith({ osId: paid.id });
  });

  it('moves EXECUTION to FINISHED and records finishedAt on RepairCompleted', async () => {
    const { saga, repositories } = setup(executionOS);

    const result = await saga.handle(sagaReply('RepairCompleted', executionOS.id));

    expect(result).toMatchObject({ outcome: 'applied', serviceOrder: { status: 'FINISHED' } });
    expect(repositories.serviceOrders.update).toHaveBeenCalledWith(executionOS.id, { status: 'FINISHED', finishedAt: NOW }, { expectedVersion: executionOS.version });
  });

  it('ignores a RepairStarted for an order that was not paid', async () => {
    const { saga, repositories } = setup(approvedOS);

    expect(await saga.handle(sagaReply('RepairStarted', approvedOS.id))).toEqual({ outcome: 'ignored' });
    expect(repositories.serviceOrders.update).not.toHaveBeenCalled();
  });

  it.each([
    ['ExecutionCancelled', 'REJECTED'],
    ['ExecutionCancelled', 'CANCELLED'],
    ['BudgetCancelled', 'CANCELLED'],
  ] as const)('accepts compensation confirmations without changing the order (%s on %s)', async (type, status) => {
    const order = { ...approvedOS, status };
    const { saga, repositories, notifier, logger } = setup(order);

    const result = await saga.handle(sagaReply(type, order.id));

    expect(result).toEqual({ outcome: 'applied', serviceOrder: order });
    expect(repositories.processedMessages.markProcessed).toHaveBeenCalled();
    expect(repositories.serviceOrders.update).not.toHaveBeenCalled();
    expect(repositories.outbox.add).not.toHaveBeenCalled();
    expect(notifier.execute).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ serviceOrderId: order.id, replyType: type }));
  });

  it('ignores a BudgetCancelled for a rejected order, whose budget was never asked to be cancelled', async () => {
    const { saga } = setup({ ...approvedOS, status: 'REJECTED' });

    expect(await saga.handle(sagaReply('BudgetCancelled', approvedOS.id))).toEqual({ outcome: 'ignored' });
  });
});
