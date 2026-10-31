import { IServiceOrderRepository } from './IServiceOrderRepository';
import { IItemRepository } from './IItemRepository';

/** Repositories whose writes commit or roll back together. */
export interface TransactionalRepositories {
  serviceOrders: IServiceOrderRepository;
  items: IItemRepository;
}

/**
 * Output port for a local ACID transaction. Everything `work` writes through
 * the given repositories is committed together, or not at all when it throws.
 */
export interface IUnitOfWork {
  run<T>(work: (repositories: TransactionalRepositories) => Promise<T>): Promise<T>;
}
