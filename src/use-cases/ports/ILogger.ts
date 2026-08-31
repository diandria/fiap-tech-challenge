/**
 * Logging output port, defined by the use cases layer.
 *
 * It exists because two notification use cases need to report a delivery
 * failure. While logging happened only in middlewares and adapters, depending
 * on the library directly was legitimate and this port would have been ceremony
 * without inversion. From the moment the inner layer needs to log, the
 * inversion becomes necessary (ADR-010).
 *
 * Deliberately narrow: only the two levels the inner layer uses.
 */
export interface ILogger {
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
