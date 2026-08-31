import { Counter, Histogram } from '@prometheus-io/client';
import { registry } from './registry';

// Named after the bounded context (service orders), not after the service that
// exposes them today: when this becomes more than one service, the name holds.
export const serviceOrdersCreated = new Counter({
  name: 'service_orders_created_total',
  help: 'Total service orders opened',
  registers: [registry],
});

/**
 * Time between the order being opened and the moment it reaches each status.
 *
 * It is not the time spent in each status: the entity only stores timestamps
 * for EXECUTION, FINISHED and DELIVERED, so DIAGNOSIS and WAITING_APPROVAL
 * would have no start to derive. What can be measured honestly is the time
 * elapsed since the order was opened, which is each stage's wait as the
 * customer perceives it. Subtracting the percentiles of two neighbouring
 * statuses approximates the time spent in one.
 *
 * Buckets from 1 minute to 1 day: the scale of a repair shop, not that of an
 * HTTP request.
 */
export const serviceOrderTimeToStatus = new Histogram({
  name: 'service_orders_time_to_status_seconds',
  help: 'Time from the service order being opened until it reaches each status',
  labelNames: ['to_status'],
  buckets: [60, 300, 900, 3600, 14400, 86400],
  registers: [registry],
});
