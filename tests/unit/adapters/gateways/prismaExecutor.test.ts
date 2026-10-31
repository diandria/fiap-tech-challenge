import { withTransaction, PrismaExecutor } from '../../../../src/adapters/gateways/prismaExecutor';

describe('withTransaction', () => {
  it('should open a transaction GIVEN the full client WHEN running work', async () => {
    const tx = { marker: 'tx' };
    const client = { $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)) };
    const work = jest.fn().mockResolvedValue('done');

    const result = await withTransaction(client as unknown as PrismaExecutor, work);

    expect(client.$transaction).toHaveBeenCalled();
    expect(work).toHaveBeenCalledWith(tx);
    expect(result).toBe('done');
  });

  it('should reuse the given transaction client GIVEN a client already inside a transaction WHEN running work', async () => {
    const transactionClient = { marker: 'already-in-tx' };
    const work = jest.fn().mockResolvedValue('done');

    const result = await withTransaction(transactionClient as unknown as PrismaExecutor, work);

    expect(work).toHaveBeenCalledWith(transactionClient);
    expect(result).toBe('done');
  });
});
