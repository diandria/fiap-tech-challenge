import { Histogram } from '@prometheus-io/client';
import { registry } from './registry';

// Buckets de resposta em cache ate timeout.
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duracao das requisicoes HTTP em segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5],
  registers: [registry],
});
