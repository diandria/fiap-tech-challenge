import { Prisma, PrismaClient } from '@prisma/client';

/** The full client, or the client of an interactive transaction already in progress. */
export type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

/**
 * Runs `work` inside the caller's transaction when there is one, otherwise
 * opens a new one. A transaction client cannot open a nested transaction, so
 * a repository built on one has to reuse it.
 */
export function withTransaction<T>(
  executor: PrismaExecutor,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return '$transaction' in executor ? executor.$transaction(work) : work(executor);
}
