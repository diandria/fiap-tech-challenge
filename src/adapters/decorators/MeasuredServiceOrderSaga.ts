import { IServiceOrderSaga } from '../../use-cases/ports/input/IServiceOrderSaga';
import { ISagaMetrics } from '../../use-cases/ports/ISagaMetrics';
import { IBusinessMetrics } from '../../use-cases/ports/IBusinessMetrics';
import { FailedSagaCommand, SagaReply, SagaReplyResult } from '../../use-cases/saga/messages';
import { observeTimeToStatus } from './observeTimeToStatus';

/**
 * Metrics around the orchestrator, kept out of it the same way the manual
 * transitions keep theirs: the saga decides, this records what it decided.
 */
export class MeasuredServiceOrderSaga implements IServiceOrderSaga {
  constructor(
    private readonly inner: IServiceOrderSaga,
    private readonly saga: ISagaMetrics,
    private readonly business: IBusinessMetrics,
  ) {}

  async handle(reply: SagaReply): Promise<SagaReplyResult> {
    const result = await this.inner.handle(reply);
    this.saga.replyHandled(reply.type, result.outcome);
    this.record(result);
    return result;
  }

  async handleFailedCommand(command: FailedSagaCommand): Promise<SagaReplyResult> {
    const result = await this.inner.handleFailedCommand(command);
    if (result.stuck) this.saga.stepStuck(command.type);
    this.record(result);
    return result;
  }

  private record(result: SagaReplyResult): void {
    if (result.compensation) this.saga.compensated(result.compensation);
    // The same histogram the manual transitions feed, so the dashboard keeps
    // one view of how long an order takes to reach each status.
    if (result.statusChanged && result.serviceOrder) observeTimeToStatus(result.serviceOrder, this.business);
  }
}
