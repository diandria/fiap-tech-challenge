/**
 * Output port that exposes the current trace context as a W3C `traceparent`.
 *
 * The value is ambient: it lives in the request scope, not in the arguments.
 * Exposing it as a port keeps the adapter that publishes events free of the
 * storage mechanism that carries it.
 */
export interface ITraceContext {
  /** The current `traceparent`, or `undefined` outside a traced request. */
  currentTraceparent(): string | undefined;
}
