import { MeasuredCreateServiceOrder } from '../../../../src/adapters/decorators/MeasuredCreateServiceOrder';
import { FakeBusinessMetrics } from '../../../support/FakeBusinessMetrics';
import { ServiceOrder } from '../../../../src/entities/ServiceOrder';

function anOrder(): ServiceOrder {
  return {
    id: 'os1',
    customerId: 'c1',
    vehicleId: 'v1',
    status: 'RECEIVED',
    services: [],
    items: [],
    createdAt: new Date(),
  };
}

describe('MeasuredCreateServiceOrder', () => {
  it('should increment the counter GIVEN a successful creation WHEN executed', async () => {
    const inner = { execute: jest.fn().mockResolvedValue(anOrder()) };
    const metrics = new FakeBusinessMetrics();
    const decorated = new MeasuredCreateServiceOrder(inner, metrics);

    await decorated.execute({ customerId: 'c1', vehicleId: 'v1' });

    expect(metrics.created).toHaveLength(1);
  });

  // Proves LSP: the decorator returns the same result, leaving the contract intact.
  it('should delegate the result unchanged GIVEN any input WHEN executed', async () => {
    const expected = anOrder();
    const inner = { execute: jest.fn().mockResolvedValue(expected) };
    const decorated = new MeasuredCreateServiceOrder(inner, new FakeBusinessMetrics());

    const result = await decorated.execute({ customerId: 'c1', vehicleId: 'v1' });

    expect(result).toBe(expected);
    expect(inner.execute).toHaveBeenCalledWith({ customerId: 'c1', vehicleId: 'v1' });
  });

  // A failed attempt must not increment the counter of opened orders.
  it('should not increment GIVEN the use case throws WHEN executed', async () => {
    const inner = { execute: jest.fn().mockRejectedValue(new Error('insufficient stock')) };
    const metrics = new FakeBusinessMetrics();
    const decorated = new MeasuredCreateServiceOrder(inner, metrics);

    await expect(decorated.execute({ customerId: 'c1', vehicleId: 'v1' })).rejects.toThrow();

    expect(metrics.created).toHaveLength(0);
  });
});
