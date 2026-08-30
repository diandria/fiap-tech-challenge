import { Prisma } from '@prisma/client';
import { integrationFailures } from '../metrics/integrationMetrics';
import { isConnectivityError } from './isConnectivityError';

/**
 * Conta indisponibilidade do banco em um lugar so.
 *
 * Instrumentar aqui em vez de nos seis gateways evita repetir try/catch em cada
 * metodo e garante que nenhuma consulta futura escape da contagem. Relanca
 * sempre: quem decide o que fazer com o erro e a camada de cima.
 */
export const countConnectivityFailures: Prisma.Middleware = async (params, next) => {
  try {
    return await next(params);
  } catch (err) {
    if (isConnectivityError(err)) {
      integrationFailures.inc({ integration: 'postgres', operation: params.action });
    }
    throw err;
  }
};
