import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { PrismaInstrumentation } from '@prisma/instrumentation';

let sdk: NodeSDK | undefined;

/**
 * Inicializa o SDK quando existe um coletor configurado.
 *
 * Sem OTEL_EXPORTER_OTLP_ENDPOINT nao inicializa: desenvolvimento local e a
 * suite de testes nao precisam subir um coletor, e o middleware de contexto
 * continua gerando identificadores por conta propria nesse cenario.
 */
export function startTracing(): NodeSDK | undefined {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint || sdk) return sdk;

  sdk = new NodeSDK({
    // Os tres atributos sao exatamente os que o logger emite (M2.T1). E essa
    // igualdade que deixa registro, metrica e trace falando do mesmo servico.
    resource: new Resource({
      'service.name': process.env.OTEL_SERVICE_NAME ?? 'car-repair-shop-api',
      'service.version': process.env.SERVICE_VERSION ?? '0.0.0',
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    // O Prisma precisa de instrumentacao propria: ele nao usa o driver pg, fala
    // com o proprio query engine, entao a auto-instrumentacao sozinha entrega
    // traces sem nenhum span de banco. Um trace que nao mostra o tempo gasto em
    // consulta perde justamente o que se vai procurar nele.
    instrumentations: [getNodeAutoInstrumentations(), new PrismaInstrumentation()],
  });

  sdk.start();
  process.on('SIGTERM', () => void sdk?.shutdown());
  return sdk;
}
