import { ServiceOrder } from '../../entities/ServiceOrder';
import { IBusinessMetrics } from '../../use-cases/ports/IBusinessMetrics';

/**
 * Records the elapsed time from the order being opened until it reaches the
 * new status. Derived from `createdAt`, not from a stopwatch around the call.
 */
export function observeTimeToStatus(order: ServiceOrder, metrics: IBusinessMetrics): void {
  const elapsedSeconds = (Date.now() - order.createdAt.getTime()) / 1000;
  metrics.timeToStatus(order.status, elapsedSeconds);
}
