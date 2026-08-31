import { IBusinessMetrics } from '../../use-cases/ports/IBusinessMetrics';
import { OSStatus } from '../../entities/ServiceOrder';
import { serviceOrdersCreated, serviceOrderTimeToStatus } from './businessMetrics';

/**
 * Prometheus-backed implementation of the business metrics port.
 *
 * The counters stay module-level because prom-client registers them globally;
 * this class is the seam that keeps that fact inside the outermost layer.
 */
export class PrometheusBusinessMetrics implements IBusinessMetrics {
  serviceOrderCreated(): void {
    serviceOrdersCreated.inc();
  }

  timeToStatus(status: OSStatus, elapsedSeconds: number): void {
    serviceOrderTimeToStatus.observe({ to_status: status }, elapsedSeconds);
  }
}
