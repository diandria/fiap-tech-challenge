import { SnsNotificationService } from '../../../../src/adapters/services/SnsNotificationService';
import { runWithTraceContext } from '../../../../src/frameworks/logging/context';
import { FakeIntegrationFailures } from '../../../support/FakeBusinessMetrics';
import { ITraceContext } from '../../../../src/use-cases/ports/ITraceContext';
import { AsyncLocalStorageTraceContext } from '../../../../src/frameworks/logging/AsyncLocalStorageTraceContext';
import { cpfCustomer } from '../../fixtures/customer';
import { waitingApprovalOS } from '../../fixtures/serviceOrder';

const TOPIC = 'arn:aws:sns:us-east-1:000000000000:topic';
const TRACE_ID = 'a'.repeat(32);
const SPAN_ID = 'b'.repeat(16);

function makeSns() {
  return { send: jest.fn().mockResolvedValue({ MessageId: 'm-1' }) };
}

function publishedPayload(sns: { send: jest.Mock }): Record<string, never> {
  return JSON.parse(sns.send.mock.calls[0][0].input.Message);
}

let failures: FakeIntegrationFailures;

// The real implementation, so the test also covers the AsyncLocalStorage
// reading. A stub here would leave the ambient path untested.
const traceContext: ITraceContext = new AsyncLocalStorageTraceContext();

beforeEach(() => {
  failures = new FakeIntegrationFailures();
});

describe('SnsNotificationService', () => {
  // This test validates the ADR-003 contract field by field. It is the only
  // automated defence against divergence between publisher (here) and consumer
  // (the notifications function), which live in different repositories.
  it('should publish a payload matching the adr-003 contract GIVEN a status change', async () => {
    const sns = makeSns();
    const service = new SnsNotificationService(sns as never, TOPIC, failures, traceContext);

    await runWithTraceContext({ traceId: TRACE_ID, spanId: SPAN_ID }, () =>
      service.notifyStatusChanged(cpfCustomer, waitingApprovalOS),
    );

    const payload = publishedPayload(sns) as Record<string, never>;
    expect(payload.eventType).toBe('SERVICE_ORDER_STATUS_CHANGED');
    expect(payload.traceparent).toBe(`00-${TRACE_ID}-${SPAN_ID}-01`);
    expect(payload.serviceOrder).toEqual(
      expect.objectContaining({ id: waitingApprovalOS.id, status: waitingApprovalOS.status }),
    );
    expect(payload.customer).toEqual({
      id: cpfCustomer.id,
      name: cpfCustomer.name,
      email: cpfCustomer.email,
    });
    expect(payload.occurredAt).toBeDefined();
  });

  it('should target the configured topic GIVEN any notification', async () => {
    const sns = makeSns();
    await new SnsNotificationService(sns as never, TOPIC, failures, traceContext).notifyStatusChanged(cpfCustomer, waitingApprovalOS);

    expect(sns.send.mock.calls[0][0].input.TopicArn).toBe(TOPIC);
  });

  it('should emit BUDGET_READY with the amount GIVEN a budget notification', async () => {
    const sns = makeSns();
    const service = new SnsNotificationService(sns as never, TOPIC, failures, traceContext);

    await service.notifyBudgetReady(cpfCustomer, { ...waitingApprovalOS, budgetTotal: 1234.56 });

    const payload = publishedPayload(sns) as Record<string, never>;
    expect(payload.eventType).toBe('BUDGET_READY');
    expect((payload.serviceOrder as Record<string, number>).budgetTotal).toBe(1234.56);
  });

  // Outside an HTTP request there is no trace context. Publishing an invalid
  // traceparent would be worse than omitting it: the consumer would record it
  // and Grafana would stitch unrelated events together.
  it('should omit traceparent GIVEN no trace context WHEN publishing', async () => {
    const sns = makeSns();
    await new SnsNotificationService(sns as never, TOPIC, failures, traceContext).notifyStatusChanged(cpfCustomer, waitingApprovalOS);

    expect(publishedPayload(sns)).not.toHaveProperty('traceparent');
  });

  it('should increment the failure counter GIVEN sns is unavailable', async () => {
    const sns = { send: jest.fn().mockRejectedValue(new Error('down')) };
    const service = new SnsNotificationService(sns as never, TOPIC, failures, traceContext);

    await expect(service.notifyStatusChanged(cpfCustomer, waitingApprovalOS)).rejects.toThrow();

    const labels = failures.recorded[0];
    expect(labels.integration).toBe('sns');
    expect(labels.operation).toBe('status_changed');
  });

  it('should label the failure as budget_ready GIVEN the budget notification fails', async () => {
    const sns = { send: jest.fn().mockRejectedValue(new Error('down')) };
    const service = new SnsNotificationService(sns as never, TOPIC, failures, traceContext);

    await expect(service.notifyBudgetReady(cpfCustomer, waitingApprovalOS)).rejects.toThrow();

    const labels = failures.recorded[0];
    expect(labels.operation).toBe('budget_ready');
  });
});
