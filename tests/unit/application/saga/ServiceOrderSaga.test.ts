import { ServiceOrderSaga } from '../../../../src/use-cases/saga/ServiceOrderSaga';
import { ServiceOrder } from '../../../../src/entities/ServiceOrder';
import { IUnitOfWork, TransactionalRepositories } from '../../../../src/use-cases/ports/IUnitOfWork';
import { IItemRepository } from '../../../../src/use-cases/ports/IItemRepository';
import { makeOSRepo, receivedOS, baseOS, waitingApprovalOS } from '../../fixtures/serviceOrder';
import { makeItemRepo, stockedItem, reservedItem } from '../../fixtures/item';
import { makeServiceRepo, baseService } from '../../fixtures/service';
import { makeCustomerRepo, cpfCustomer } from '../../fixtures/customer';
import { sagaReply } from '../../../support/sagaReplies';

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
  const logger = { warn: jest.fn(), error: jest.fn() };
  const saga = new ServiceOrderSaga(unitOfWork, makeServiceRepo(), makeCustomerRepo(), notifier, logger);
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
});
