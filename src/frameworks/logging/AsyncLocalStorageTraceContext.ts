import { ITraceContext } from '../../use-cases/ports/ITraceContext';
import { getTraceContext, toTraceparent } from './context';

/**
 * Reads the trace context from the request-scoped AsyncLocalStorage.
 *
 * Returns `undefined` outside an HTTP request, where there is no trace to
 * propagate. Emitting an invalid `traceparent` would be worse than emitting
 * none: the consumer would record it and unrelated events would be stitched
 * together as one trace.
 */
export class AsyncLocalStorageTraceContext implements ITraceContext {
  currentTraceparent(): string | undefined {
    const ctx = getTraceContext();
    return ctx ? toTraceparent(ctx) : undefined;
  }
}
