import { PrismaClient } from '@prisma/client';
import { IUnitOfWork, TransactionalRepositories } from '../../use-cases/ports/IUnitOfWork';
import { PostgresServiceOrderRepository } from './PostgresServiceOrderRepository';
import { PostgresItemRepository } from './PostgresItemRepository';

export class PrismaUnitOfWork implements IUnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  run<T>(work: (repositories: TransactionalRepositories) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) =>
      work({
        serviceOrders: new PostgresServiceOrderRepository(tx),
        items: new PostgresItemRepository(tx),
      }),
    );
  }
}
