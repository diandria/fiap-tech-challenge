import { Registry, collectDefaultMetrics } from '@prometheus-io/client';

export const registry = new Registry();

// A identidade do servico vive em rotulo, nunca no nome da metrica (ADR-007):
// o nome fica generico (http_request_duration_seconds) e serve para comparar
// servicos diferentes no mesmo painel quando isto virar mais de um servico.
//
// O rotulo e service_name, com underscore. Nome de rotulo do Prometheus aceita
// apenas [a-zA-Z_][a-zA-Z0-9_]*, entao service.name sairia como
// {service.name="..."} e quebraria o parsing do scrape. E a mesma normalizacao
// que o exportador Prometheus do OpenTelemetry aplica. Nos logs e traces o
// atributo continua service.name, onde o ponto e valido.
registry.setDefaultLabels({
  service_name: process.env.OTEL_SERVICE_NAME ?? 'car-repair-shop-api',
});

collectDefaultMetrics({ register: registry });
