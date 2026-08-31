import { PrismaClient } from '@prisma/client';
import { ReadinessCheck } from '../http/routes/healthRoutes';

/**
 * A trivial query, just to prove the connection answers.
 *
 * SELECT 1 touches no table: the probe must not depend on the schema being
 * migrated, otherwise it starts failing for a reason other than the one it is
 * meant to measure.
 */
export function databaseReadiness(prisma: PrismaClient): ReadinessCheck {
  return () => prisma.$queryRaw`SELECT 1`;
}
