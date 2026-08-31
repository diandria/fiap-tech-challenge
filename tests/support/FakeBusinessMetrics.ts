import { IBusinessMetrics } from '../../src/use-cases/ports/IBusinessMetrics';
import { IIntegrationFailures } from '../../src/use-cases/ports/IIntegrationFailures';
import { OSStatus } from '../../src/entities/ServiceOrder';

/**
 * Test doubles for the metrics ports.
 *
 * They exist so the tests assert on what the adapter reported instead of
 * resetting and reading a process-wide prom-client counter, which leaked
 * state between test files.
 */
export class FakeBusinessMetrics implements IBusinessMetrics {
  readonly created: number[] = [];
  readonly statuses: { status: OSStatus; elapsedSeconds: number }[] = [];

  serviceOrderCreated(): void {
    this.created.push(1);
  }

  timeToStatus(status: OSStatus, elapsedSeconds: number): void {
    this.statuses.push({ status, elapsedSeconds });
  }
}

export class FakeIntegrationFailures implements IIntegrationFailures {
  readonly recorded: { integration: string; operation: string }[] = [];

  record(integration: string, operation: string): void {
    this.recorded.push({ integration, operation });
  }
}
