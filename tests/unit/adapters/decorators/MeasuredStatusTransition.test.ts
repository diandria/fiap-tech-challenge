import { MeasuredStatusTransition } from '../../../../src/adapters/decorators/MeasuredStatusTransition';
import { MeasuredBudgetDecision } from '../../../../src/adapters/decorators/MeasuredBudgetDecision';
import { serviceOrderTimeToStatus } from '../../../../src/frameworks/metrics/businessMetrics';
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

async function observedFor(toStatus: string): Promise<{ count: number; sum: number }> {
  const metric = await serviceOrderTimeToStatus.get();
  const of = (suffix: string) =>
    metric.values.find(
      (v) => v.metricName?.endsWith(suffix) && v.labels.to_status === toStatus,
    )?.value ?? 0;
  return { count: of('_count'), sum: of('_sum') };
}

describe('MeasuredStatusTransition', () => {
  beforeEach(() => serviceOrderTimeToStatus.reset());

  it('should observe the age of the order GIVEN a transition WHEN executed', async () => {
    const inner = { execute: jest.fn().mockResolvedValue(anOrder('EXECUTION', TWO_HOURS_MS)) };
    const decorated = new MeasuredStatusTransition(inner);

    await decorated.execute('os1');

    const { count, sum } = await observedFor('EXECUTION');
    expect(count).toBe(1);
    // Duas horas em segundos, com folga para o tempo de execucao do teste.
    expect(sum).toBeGreaterThan(7190);
    expect(sum).toBeLessThan(7210);
  });

  it('should label with the resulting status GIVEN the use case decides it WHEN executed', async () => {
    const inner = { execute: jest.fn().mockResolvedValue(anOrder('DELIVERED', TWO_HOURS_MS)) };
    const decorated = new MeasuredStatusTransition(inner);

    await decorated.execute('os1');

    expect((await observedFor('DELIVERED')).count).toBe(1);
    expect((await observedFor('EXECUTION')).count).toBe(0);
  });

  it('should delegate the result unchanged GIVEN any id WHEN executed', async () => {
    const expected = anOrder('FINISHED');
    const inner = { execute: jest.fn().mockResolvedValue(expected) };
    const decorated = new MeasuredStatusTransition(inner);

    const result = await decorated.execute('os1');

    expect(result).toBe(expected);
    expect(inner.execute).toHaveBeenCalledWith('os1');
  });

  it('should not observe GIVEN the use case throws WHEN executed', async () => {
    const inner = { execute: jest.fn().mockRejectedValue(new Error('transicao invalida')) };
    const decorated = new MeasuredStatusTransition(inner);

    await expect(decorated.execute('os1')).rejects.toThrow();

    expect((await serviceOrderTimeToStatus.get()).values).toHaveLength(0);
  });
});

describe('MeasuredBudgetDecision', () => {
  beforeEach(() => serviceOrderTimeToStatus.reset());

  // A espera do cliente entre "aguardando aprovacao" e a decisao e a duracao
  // mais relevante da oficina, e e a unica que passa por este decorator.
  it('should observe the wait GIVEN an approval WHEN executed', async () => {
    const inner = { execute: jest.fn().mockResolvedValue(anOrder('APPROVED', TWO_HOURS_MS)) };
    const decorated = new MeasuredBudgetDecision(inner);

    await decorated.execute({ osId: 'os1', code: 'CODE123' });

    const { count, sum } = await observedFor('APPROVED');
    expect(count).toBe(1);
    expect(sum).toBeGreaterThan(7190);
  });

  // O decorator nao pode perder `requesterCustomerId` no caminho: se perdesse,
  // a titularidade deixaria de ser checada em producao e continuaria passando
  // nos testes de use case, que chamam o caso de uso sem decorator.
  it('should forward the whole input GIVEN a decision WHEN executed', async () => {
    const expected = anOrder('REJECTED');
    const inner = { execute: jest.fn().mockResolvedValue(expected) };
    const decorated = new MeasuredBudgetDecision(inner);
    const input = { osId: 'os1', code: 'CODE123', requesterCustomerId: 'c-1' };

    const result = await decorated.execute(input);

    expect(result).toBe(expected);
    expect(inner.execute).toHaveBeenCalledWith(input);
  });
});
