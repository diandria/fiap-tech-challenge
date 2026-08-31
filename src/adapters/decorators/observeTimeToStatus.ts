import { ServiceOrder } from '../../entities/ServiceOrder';
import { IBusinessMetrics } from '../../use-cases/ports/IBusinessMetrics';

/**
 * Records how long it took, from the moment the order was opened, to reach the
 * status it has just moved to.
 *
 * The duration comes from `createdAt`, which the entity already carries, and
 * not from a stopwatch around the call: timing the use case would measure how
 * fast the database answered, which is milliseconds, and every observation
 * would land in the first bucket.
 */
export function observeTimeToStatus(order: ServiceOrder, metrics: IBusinessMetrics): void {
  const elapsedSeconds = (Date.now() - order.createdAt.getTime()) / 1000;
  metrics.timeToStatus(order.status, elapsedSeconds);
}
