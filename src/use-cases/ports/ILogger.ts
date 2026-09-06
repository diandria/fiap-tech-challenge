/**
 * Logging output port, defined by the use cases layer (ADR-010). Narrow on
 * purpose: only the two levels the inner layer uses.
 */
export interface ILogger {
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
