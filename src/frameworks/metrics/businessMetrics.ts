import { Counter, Histogram } from '@prometheus-io/client';
import { registry } from './registry';

// Named after the bounded context (service orders), independent of the
// service that exposes the metric.
export const serviceOrdersCreated = new Counter({
  name: 'service_orders_created_total',
  help: 'Total service orders opened',
  registers: [registry],
});

/**
 * Time from the order being opened until it reaches each status.
 *
 * Not the time spent in each status: the entity stores timestamps only for
 * EXECUTION, FINISHED and DELIVERED. Subtracting the percentiles of two
 * neighbouring statuses approximates the time spent in one.
 *
 * Buckets run from 1 minute to 1 day, the scale of a repair shop.
 */
export const serviceOrderTimeToStatus = new Histogram({
  name: 'service_orders_time_to_status_seconds',
  help: 'Time from the service order being opened until it reaches each status',
  labelNames: ['to_status'],
  buckets: [60, 300, 900, 3600, 14400, 86400],
  registers: [registry],
});
