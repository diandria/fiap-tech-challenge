import { OSStatus } from '../../entities/ServiceOrder';

/**
 * Output port for business metrics, defined by the inner layers.
 *
 * It exists so the adapters that record metrics depend on an abstraction
 * instead of importing the counters from the Frameworks & Drivers layer
 * directly. Without it the dependency points outward, which the dependency
 * rule forbids, and every test has to reset a global counter to assert on it.
 */
export interface IBusinessMetrics {
  serviceOrderCreated(): void;
  timeToStatus(status: OSStatus, elapsedSeconds: number): void;
}
