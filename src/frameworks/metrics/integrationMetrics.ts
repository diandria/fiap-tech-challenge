import { Counter } from '@prometheus-io/client';
import { registry } from './registry';

/**
 * Failures in external integrations, split by integration and operation.
 *
 * It is the trigger for the alert on service order processing failures:
 * notifications are best-effort and the use cases swallow the error on purpose,
 * because a notification must not roll back a status transition. Without this
 * counter, a broken integration stays invisible until somebody complains.
 */
export const integrationFailures = new Counter({
  name: 'integration_failures_total',
  help: 'Failures in external integrations',
  labelNames: ['integration', 'operation'],
  registers: [registry],
});
