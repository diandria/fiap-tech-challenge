import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { PrismaInstrumentation } from '@prisma/instrumentation';

let sdk: NodeSDK | undefined;

/**
 * Starts the SDK when a collector is configured.
 *
 * With no OTEL_EXPORTER_OTLP_ENDPOINT it does not start: local development and
 * the test suite do not need to bring a collector up, and the context
 * middleware keeps minting identifiers on its own in that scenario.
 */
export function startTracing(): NodeSDK | undefined {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint || sdk) return sdk;

  sdk = new NodeSDK({
    // These three attributes are exactly the ones the logger emits (M2.T1).
    // That sameness is what keeps log, metric and trace talking about the same
    // service.
    resource: new Resource({
      'service.name': process.env.OTEL_SERVICE_NAME ?? 'car-repair-shop-api',
      'service.version': process.env.SERVICE_VERSION ?? '0.0.0',
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    // Prisma needs its own instrumentation: it does not use the pg driver, it
    // talks to its own query engine, so auto-instrumentation alone delivers
    // traces with no database span at all. A trace that does not show time
    // spent in queries loses exactly what people open it to find.
    instrumentations: [getNodeAutoInstrumentations(), new PrismaInstrumentation()],
  });

  sdk.start();
  process.on('SIGTERM', () => void sdk?.shutdown());
  return sdk;
}
