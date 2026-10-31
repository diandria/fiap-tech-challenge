import { IUnitOfWork } from '../../../src/use-cases/ports/IUnitOfWork';
import { IServiceOrderRepository } from '../../../src/use-cases/ports/IServiceOrderRepository';
import { IItemRepository } from '../../../src/use-cases/ports/IItemRepository';
import { IOutbox } from '../../../src/use-cases/ports/IOutbox';

/**
 * Hands the given repositories to the work. Rolling back is the real unit of
 * work's job; tests assert that a failure leaves `run` rejected.
 */
export const makeUnitOfWork = (
  osRepo: IServiceOrderRepository,
  itemRepo: IItemRepository,
  outbox: IOutbox = { add: jest.fn() },
): IUnitOfWork & { run: jest.Mock } => ({
  run: jest.fn((work) => work({ serviceOrders: osRepo, items: itemRepo, outbox, processedMessages: { markProcessed: jest.fn().mockResolvedValue(true) } })),
});
