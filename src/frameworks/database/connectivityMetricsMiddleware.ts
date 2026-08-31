import { Prisma } from '@prisma/client';
import { integrationFailures } from '../metrics/integrationMetrics';
import { isConnectivityError } from './isConnectivityError';

/**
 * Counts database unavailability in a single place.
 *
 * Instrumenting here instead of in the six gateways avoids repeating try/catch
 * in every method and guarantees no future query escapes the count. It always
 * rethrows: deciding what to do with the error belongs to the layer above.
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
