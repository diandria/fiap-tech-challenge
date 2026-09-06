import { Prisma } from '@prisma/client';
import { integrationFailures } from '../metrics/integrationMetrics';
import { isConnectivityError } from './isConnectivityError';

/**
 * Counts database unavailability in one place, so no gateway method has to
 * repeat a try/catch. Always rethrows.
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
