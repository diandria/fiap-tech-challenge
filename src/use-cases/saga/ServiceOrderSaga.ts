import { OSStatus, ServiceOrder } from '../../entities/ServiceOrder';
import { NotFoundError } from '../../entities/errors/AppError';
import { assertTransition } from '../../entities/serviceOrderStateMachine';
import { IUnitOfWork, TransactionalRepositories } from '../ports/IUnitOfWork';
import { IStatusChangeNotifier } from '../ports/IStatusChangeNotifier';
import { ILogger } from '../ports/ILogger';
import { IServiceOrderSaga } from '../ports/input/IServiceOrderSaga';
import { SagaReply, SagaReplyResult, SagaReplyType } from './messages';

/**
 * The status each reply expects to find, the same table as ADR-014. With a
 * FIFO queue per order, any other status means a repeat that came back after
 * the deduplication window, and the reply is dropped.
 */
const EXPECTED_STATUS: Record<SagaReplyType, OSStatus[]> = {
  DiagnosisStarted: ['RECEIVED'],
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
    }
  }

  private diagnosisStarted(order: ServiceOrder, { serviceOrders }: TransactionalRepositories): Promise<ServiceOrder> {
    return this.moveTo(order, 'DIAGNOSIS', serviceOrders);
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
