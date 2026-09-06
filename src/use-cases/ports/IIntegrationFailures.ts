/**
 * Output port for integration failures. Notification errors are swallowed by
 * the use cases on purpose, so this counter is the only signal that an
 * integration is broken.
 */
export interface IIntegrationFailures {
  record(integration: string, operation: string): void;
}
