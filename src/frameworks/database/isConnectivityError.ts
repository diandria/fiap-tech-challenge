import { Prisma } from '@prisma/client';

/**
 * Tells an unreachable database apart from an expected application error.
 * Prisma's P1xxx codes are connectivity; P2xxx are query errors such as a
 * unique violation, which must not count as an integration failure.
 */
export function isConnectivityError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientRustPanicError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) return err.code.startsWith('P1');
  return false;
}
