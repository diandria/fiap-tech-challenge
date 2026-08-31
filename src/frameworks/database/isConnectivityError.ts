import { Prisma } from '@prisma/client';

/**
 * Tells an unreachable database apart from an expected application error.
 *
 * Prisma's P1xxx codes are connectivity ones (server not reached, timed out,
 * connection closed). The P2xxx are query ones: unique violation, record not
 * found, foreign key. Those last ones are normal behaviour, and counting them
 * as integration failures would fire the alert over a duplicate tax id.
 */
export function isConnectivityError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientRustPanicError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) return err.code.startsWith('P1');
  return false;
}
