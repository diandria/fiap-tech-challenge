import { Registry, collectDefaultMetrics } from '@prometheus-io/client';

export const registry = new Registry();

// The service identity lives in a label, never in the metric name (ADR-007):
// the name stays generic (http_request_duration_seconds) and serves to compare
// different services on the same panel once this becomes more than one service.
//
// The label is service_name, with an underscore. A Prometheus label name only
// accepts [a-zA-Z_][a-zA-Z0-9_]*, so service.name would come out as
// {service.name="..."} and break scrape parsing. It is the same normalisation
// OpenTelemetry's Prometheus exporter applies. In logs and traces the attribute
// remains service.name, where the dot is valid.
registry.setDefaultLabels({
  service_name: process.env.OTEL_SERVICE_NAME ?? 'car-repair-shop-api',
});

collectDefaultMetrics({ register: registry });
