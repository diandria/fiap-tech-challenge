import { Counter } from '@prometheus-io/client';
import { registry } from './registry';

/**
 * Failures in external integrations, by integration and operation. It backs
 * the alert on service order processing: the use cases swallow delivery errors
 * on purpose, so this counter is the only signal.
 */
export const integrationFailures = new Counter({
  name: 'integration_failures_total',
  help: 'Failures in external integrations',
  labelNames: ['integration', 'operation'],
  registers: [registry],
});
