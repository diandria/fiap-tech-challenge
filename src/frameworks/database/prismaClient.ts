import { PrismaClient } from '@prisma/client';
import { countConnectivityFailures } from './connectivityMetricsMiddleware';

/**
 * Single client instance. Only the Composition Root (main.ts) and the test
 * setup know this module: the gateways receive the client through their
 * constructor.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
});

prisma.$use(countConnectivityFailures);

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
