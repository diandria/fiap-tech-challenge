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

  // A labelled series is born at 1 on its first increment, and increase()
  // cannot see the step from "absent" to 1. Without zero-valued series the
  // first compensation of each reason never reaches a dashboard or an alert.
  it('starts every known series at zero before any saga event', async () => {
    const text = await registry.metrics();

    expect(text).toMatch(/saga_compensations_total\{[^}]*reason="STEP_FAILED"[^}]*\} 0/);
    expect(text).toMatch(/saga_stuck_total\{[^}]*command="CancelBudget"[^}]*\} 0/);
    expect(text).toMatch(/saga_replies_total\{[^}]*type="DiagnosisStarted",outcome="duplicate"[^}]*\} 0/);
  });
});
