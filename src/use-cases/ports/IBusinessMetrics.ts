import { OSStatus } from '../../entities/ServiceOrder';

/**
 * Output port for business metrics, so adapters depend on an abstraction
 * rather than importing counters from the outermost layer.
 */
export interface IBusinessMetrics {
  serviceOrderCreated(): void;
  timeToStatus(status: OSStatus, elapsedSeconds: number): void;
}
