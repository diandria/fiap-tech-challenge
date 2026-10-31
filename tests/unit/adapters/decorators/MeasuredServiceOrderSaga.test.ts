import { MeasuredServiceOrderSaga } from '../../../../src/adapters/decorators/MeasuredServiceOrderSaga';
import { IServiceOrderSaga } from '../../../../src/use-cases/ports/input/IServiceOrderSaga';
import { SagaReplyResult } from '../../../../src/use-cases/saga/messages';
import { FakeBusinessMetrics, FakeSagaMetrics } from '../../../support/FakeBusinessMetrics';
import { waitingApprovalOS } from '../../fixtures/serviceOrder';
import { sagaReply } from '../../../support/sagaReplies';

function measured(result: SagaReplyResult) {
  const inner: jest.Mocked<IServiceOrderSaga> = {
    handle: jest.fn().mockResolvedValue(result),
    handleFailedCommand: jest.fn().mockResolvedValue(result),
  };
  const saga = new FakeSagaMetrics();
  const business = new FakeBusinessMetrics();
  return { decorated: new MeasuredServiceOrderSaga(inner, saga, business), saga, business, inner };
}

const rejected = { ...waitingApprovalOS, status: 'REJECTED' as const };

describe('MeasuredServiceOrderSaga', () => {
  it('counts each reply by type and outcome', async () => {
    const { decorated, saga } = measured({ outcome: 'duplicate' });

    const result = await decorated.handle(sagaReply('BudgetApproved', 'os-1'));

    expect(result).toEqual({ outcome: 'duplicate' });
    expect(saga.replies).toEqual([{ type: 'BudgetApproved', outcome: 'duplicate' }]);
  });

  it('counts a compensation when the result carries one', async () => {
    const { decorated, saga } = measured({ outcome: 'applied', serviceOrder: rejected, statusChanged: true, compensation: 'BUDGET_REJECTED' });

    await decorated.handle(sagaReply('BudgetRejected', 'os-1'));

    expect(saga.compensations).toEqual(['BUDGET_REJECTED']);
  });

  it('observes time to status only for applied replies that changed the status', async () => {
    const changed = measured({ outcome: 'applied', serviceOrder: rejected, statusChanged: true });
    const unchanged = measured({ outcome: 'applied', serviceOrder: waitingApprovalOS });
    const ignored = measured({ outcome: 'ignored' });

    await changed.decorated.handle(sagaReply('BudgetRejected', 'os-1'));
    await unchanged.decorated.handle(sagaReply('BudgetGenerated', 'os-1'));
    await ignored.decorated.handle(sagaReply('BudgetRejected', 'os-1'));

    expect(changed.business.statuses.map((s) => s.status)).toEqual(['REJECTED']);
    expect(unchanged.business.statuses).toEqual([]);
    expect(ignored.business.statuses).toEqual([]);
  });

  it('counts a stuck step and a step failure compensation for dead commands, not as replies', async () => {
    const stuck = measured({ outcome: 'applied', serviceOrder: waitingApprovalOS, stuck: true });
    const compensated = measured({ outcome: 'applied', serviceOrder: rejected, statusChanged: true, compensation: 'STEP_FAILED' });

    await stuck.decorated.handleFailedCommand({ messageId: 'm-1', type: 'EnqueueRepair', serviceOrderId: 'os-1' });
    await compensated.decorated.handleFailedCommand({ messageId: 'm-2', type: 'GenerateBudget', serviceOrderId: 'os-1' });

    expect(stuck.saga.stuck).toEqual(['EnqueueRepair']);
    expect(stuck.saga.replies).toEqual([]);
    expect(compensated.saga.compensations).toEqual(['STEP_FAILED']);
    expect(compensated.business.statuses.map((s) => s.status)).toEqual(['REJECTED']);
  });
});
