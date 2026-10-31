import { registry } from '../../../../src/frameworks/metrics/registry';
import { PrometheusSagaMetrics } from '../../../../src/frameworks/metrics/PrometheusSagaMetrics';

describe('PrometheusSagaMetrics', () => {
  it('exposes replies, compensations and stuck steps with their labels', async () => {
    const metrics = new PrometheusSagaMetrics();

    metrics.replyHandled('BudgetApproved', 'applied');
    metrics.compensated('PAYMENT_FAILED');
    metrics.stepStuck('EnqueueRepair');

    const text = await registry.metrics();
    expect(text).toMatch(/saga_replies_total\{[^}]*type="BudgetApproved",outcome="applied"[^}]*\} 1/);
    expect(text).toMatch(/saga_compensations_total\{[^}]*reason="PAYMENT_FAILED"[^}]*\} 1/);
    expect(text).toMatch(/saga_stuck_total\{[^}]*command="EnqueueRepair"[^}]*\} 1/);
  });
});
