import { PrismaClient } from '@prisma/client';
import { PrismaUnitOfWork } from '../../../../src/adapters/gateways/PrismaUnitOfWork';
import { PostgresServiceOrderRepository } from '../../../../src/adapters/gateways/PostgresServiceOrderRepository';
import { PostgresItemRepository } from '../../../../src/adapters/gateways/PostgresItemRepository';

describe('PrismaUnitOfWork', () => {
  it('should run the work inside one interactive transaction GIVEN work WHEN run is called', async () => {
    const tx = {};
    const prisma = { $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const work = jest.fn().mockResolvedValue('created');

    const result = await new PrismaUnitOfWork(prisma as unknown as PrismaClient).run(work);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toBe('created');
    const repositories = work.mock.calls[0][0];
    expect(repositories.serviceOrders).toBeInstanceOf(PostgresServiceOrderRepository);
    expect(repositories.items).toBeInstanceOf(PostgresItemRepository);
  });
});
