import { startTracing } from './otel';

/**
 * Import for its side effect, on purpose.
 *
 * Auto-instrumentation has to monkey-patch http, express and pg before those
 * modules are loaded. TypeScript compiles to CommonJS, where imports become
 * requires in the order they appear: importing this module on the first line of
 * main.ts guarantees initialisation ahead of the rest. Calling startTracing()
 * after the import list would run too late, and the symptom would be an empty
 * trace, with no error at all.
 */
startTracing();
