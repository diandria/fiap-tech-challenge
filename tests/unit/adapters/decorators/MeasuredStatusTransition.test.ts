import { MeasuredStatusTransition } from '../../../../src/adapters/decorators/MeasuredStatusTransition';
import { MeasuredBudgetDecision } from '../../../../src/adapters/decorators/MeasuredBudgetDecision';
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

describe('MeasuredBudgetDecision', () => {
  // Measures the wait between "awaiting approval" and the customer's
  // decision.
  it('should observe the wait GIVEN an approval WHEN executed', async () => {
    const inner = { execute: jest.fn().mockResolvedValue(anOrder('APPROVED', TWO_HOURS_MS)) };
    const metrics = new FakeBusinessMetrics();
    const decorated = new MeasuredBudgetDecision(inner, metrics);

    await decorated.execute({ osId: 'os1', code: 'CODE123' });

    const { count, sum } = observedFor(metrics, 'APPROVED');
    expect(count).toBe(1);
    expect(sum).toBeGreaterThan(7190);
  });

  // Dropping `requesterCustomerId` would silently disable ownership in
  // production while the use-case tests, which skip the decorator, still pass.
  it('should forward the whole input GIVEN a decision WHEN executed', async () => {
    const expected = anOrder('REJECTED');
    const inner = { execute: jest.fn().mockResolvedValue(expected) };
    const decorated = new MeasuredBudgetDecision(inner, new FakeBusinessMetrics());
    const input = { osId: 'os1', code: 'CODE123', requesterCustomerId: 'c-1' };

    const result = await decorated.execute(input);

    expect(result).toBe(expected);
    expect(inner.execute).toHaveBeenCalledWith(input);
  });
});
