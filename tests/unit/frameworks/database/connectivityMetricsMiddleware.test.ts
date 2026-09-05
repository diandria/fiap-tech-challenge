import { Prisma } from '@prisma/client';
import { countConnectivityFailures } from '../../../../src/frameworks/database/connectivityMetricsMiddleware';
import { integrationFailures } from '../../../../src/frameworks/metrics/integrationMetrics';

const params = { model: 'Customer', action: 'findMany', args: {}, dataPath: [], runInTransaction: false } as Prisma.MiddlewareParams;

function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: '5.22.0' });
}

async function series(): Promise<{ labels: Record<string, string | number>; value: number }[]> {
  return (await integrationFailures.get()).values.map((v) => ({ labels: v.labels, value: v.value }));
}

describe('countConnectivityFailures', () => {
  beforeEach(() => integrationFailures.reset());

  it('should not count anything GIVEN the query succeeds WHEN it runs', async () => {
    const result = await countConnectivityFailures(params, async () => ['ok']);

    expect(result).toEqual(['ok']);
    expect(await series()).toHaveLength(0);
  });

  it('should count the failure GIVEN the database is unreachable WHEN the query runs', async () => {
    const next = async () => {
      throw knownError('P1001');
    };

    await expect(countConnectivityFailures(params, next)).rejects.toThrow();

    expect(await series()).toEqual([
      { labels: { integration: 'postgres', operation: 'findMany' }, value: 1 },
    ]);
  });

  // A uniqueness violation is expected application behaviour. Counting it would
  // make the alert fire on a duplicate tax id.
  it('should not count GIVEN a unique constraint violation WHEN the query runs', async () => {
    const next = async () => {
      throw knownError('P2002');
    };

    await expect(countConnectivityFailures(params, next)).rejects.toThrow();

    expect(await series()).toHaveLength(0);
  });

  it('should rethrow the original error GIVEN any failure WHEN the query runs', async () => {
    const original = knownError('P1001');
    const next = async () => {
      throw original;
    };

    await expect(countConnectivityFailures(params, next)).rejects.toBe(original);
  });
});
