/**
 * Output port for integration failures, defined by the inner layers.
 *
 * Notifications are best-effort and the use cases swallow delivery errors on
 * purpose, because a failed e-mail must not roll back a status transition.
 * This counter is the only signal that an integration is broken, so the
 * adapters that report it must not depend on the concrete metric registry.
 */
export interface IIntegrationFailures {
  record(integration: string, operation: string): void;
}
