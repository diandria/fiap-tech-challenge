import { MeasuredStatusTransition } from '../../../../src/adapters/decorators/MeasuredStatusTransition';
import { FakeBusinessMetrics } from '../../../support/FakeBusinessMetrics';
import { ServiceOrder, OSStatus } from '../../../../src/entities/ServiceOrder';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function anOrder(status: OSStatus, ageMs = 0): ServiceOrder {
  return {
    id: 'os1',
    customerId: 'c1',
    vehicleId: 'v1',
    status,
    services: [],
    items: [],
    createdAt: new Date(Date.now() - ageMs),
    version: 0,
  };
}

function observedFor(metrics: FakeBusinessMetrics, toStatus: string) {
  const matching = metrics.statuses.filter((s) => s.status === toStatus);
  return {
    count: matching.length,
    sum: matching.reduce((total, s) => total + s.elapsedSeconds, 0),
  };
}

describe('MeasuredStatusTransition', () => {
  it('should observe the age of the order GIVEN a transition WHEN executed', async () => {
    const inner = { execute: jest.fn().mockResolvedValue(anOrder('EXECUTION', TWO_HOURS_MS)) };
    const metrics = new FakeBusinessMetrics();
    const decorated = new MeasuredStatusTransition(inner, metrics);

    await decorated.execute('os1');

    const { count, sum } = observedFor(metrics, 'EXECUTION');
    expect(count).toBe(1);
    // Two hours in seconds, with slack for the test's own run time.
    expect(sum).toBeGreaterThan(7190);
    expect(sum).toBeLessThan(7210);
  });

  it('should label with the resulting status GIVEN the use case decides it WHEN executed', async () => {
    const inner = { execute: jest.fn().mockResolvedValue(anOrder('DELIVERED', TWO_HOURS_MS)) };
    const metrics = new FakeBusinessMetrics();
    const decorated = new MeasuredStatusTransition(inner, metrics);

    await decorated.execute('os1');

    expect(observedFor(metrics, 'DELIVERED').count).toBe(1);
    expect(observedFor(metrics, 'EXECUTION').count).toBe(0);
  });

  it('should delegate the result unchanged GIVEN any id WHEN executed', async () => {
    const expected = anOrder('FINISHED');
    const inner = { execute: jest.fn().mockResolvedValue(expected) };
    const decorated = new MeasuredStatusTransition(inner, new FakeBusinessMetrics());

    const result = await decorated.execute('os1');

    expect(result).toBe(expected);
    expect(inner.execute).toHaveBeenCalledWith('os1');
  });

  it('should not observe GIVEN the use case throws WHEN executed', async () => {
    const inner = { execute: jest.fn().mockRejectedValue(new Error('invalid transition')) };
    const metrics = new FakeBusinessMetrics();
    const decorated = new MeasuredStatusTransition(inner, metrics);

    await expect(decorated.execute('os1')).rejects.toThrow();

    expect(metrics.statuses).toHaveLength(0);
  });
});
