import { SnsNotificationService } from '../../../../src/adapters/services/SnsNotificationService';
import { runWithTraceContext } from '../../../../src/frameworks/logging/context';
import { integrationFailures } from '../../../../src/frameworks/metrics/integrationMetrics';
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

beforeEach(() => {
  integrationFailures.reset();
});

describe('SnsNotificationService', () => {
  // Este teste valida o contrato do ADR-003 campo a campo. E a unica defesa
  // automatizada contra a divergencia entre publicador (aqui) e consumidor (a
  // function de notificacoes), que vivem em repositorios diferentes.
  it('should publish a payload matching the adr-003 contract GIVEN a status change', async () => {
    const sns = makeSns();
    const service = new SnsNotificationService(sns as never, TOPIC);

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
    await new SnsNotificationService(sns as never, TOPIC).notifyStatusChanged(cpfCustomer, waitingApprovalOS);

    expect(sns.send.mock.calls[0][0].input.TopicArn).toBe(TOPIC);
  });

  it('should emit BUDGET_READY with the amount GIVEN a budget notification', async () => {
    const sns = makeSns();
    const service = new SnsNotificationService(sns as never, TOPIC);

    await service.notifyBudgetReady(cpfCustomer, { ...waitingApprovalOS, budgetTotal: 1234.56 });

    const payload = publishedPayload(sns) as Record<string, never>;
    expect(payload.eventType).toBe('BUDGET_READY');
    expect((payload.serviceOrder as Record<string, number>).budgetTotal).toBe(1234.56);
  });

  // Fora de uma requisicao HTTP nao ha contexto de rastro. Publicar um
  // traceparent invalido seria pior que omitir: o consumidor o registraria e o
  // Grafana juntaria eventos sem relacao.
  it('should omit traceparent GIVEN no trace context WHEN publishing', async () => {
    const sns = makeSns();
    await new SnsNotificationService(sns as never, TOPIC).notifyStatusChanged(cpfCustomer, waitingApprovalOS);

    expect(publishedPayload(sns)).not.toHaveProperty('traceparent');
  });

  it('should increment the failure counter GIVEN sns is unavailable', async () => {
    const sns = { send: jest.fn().mockRejectedValue(new Error('down')) };
    const service = new SnsNotificationService(sns as never, TOPIC);

    await expect(service.notifyStatusChanged(cpfCustomer, waitingApprovalOS)).rejects.toThrow();

    const labels = (await integrationFailures.get()).values[0].labels as Record<string, string>;
    expect(labels.integration).toBe('sns');
    expect(labels.operation).toBe('status_changed');
  });

  it('should label the failure as budget_ready GIVEN the budget notification fails', async () => {
    const sns = { send: jest.fn().mockRejectedValue(new Error('down')) };
    const service = new SnsNotificationService(sns as never, TOPIC);

    await expect(service.notifyBudgetReady(cpfCustomer, waitingApprovalOS)).rejects.toThrow();

    const labels = (await integrationFailures.get()).values[0].labels as Record<string, string>;
    expect(labels.operation).toBe('budget_ready');
  });
});
