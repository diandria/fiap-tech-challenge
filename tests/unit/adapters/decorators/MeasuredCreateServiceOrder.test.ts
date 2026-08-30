import { MeasuredCreateServiceOrder } from '../../../../src/adapters/decorators/MeasuredCreateServiceOrder';
import { serviceOrdersCreated } from '../../../../src/frameworks/metrics/businessMetrics';
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
  beforeEach(() => serviceOrdersCreated.reset());

  it('should increment the counter GIVEN a successful creation WHEN executed', async () => {
    const inner = { execute: jest.fn().mockResolvedValue(anOrder()) };
    const decorated = new MeasuredCreateServiceOrder(inner);

    await decorated.execute({ customerId: 'c1', vehicleId: 'v1' });

    const metric = await serviceOrdersCreated.get();
    expect(metric.values[0].value).toBe(1);
  });

  // Prova o LSP: o decorator devolve o mesmo resultado, sem alterar o contrato.
  it('should delegate the result unchanged GIVEN any input WHEN executed', async () => {
    const expected = anOrder();
    const inner = { execute: jest.fn().mockResolvedValue(expected) };
    const decorated = new MeasuredCreateServiceOrder(inner);

    const result = await decorated.execute({ customerId: 'c1', vehicleId: 'v1' });

    expect(result).toBe(expected);
    expect(inner.execute).toHaveBeenCalledWith({ customerId: 'c1', vehicleId: 'v1' });
  });

  // Contador de OS abertas nao pode contar tentativa que falhou: um painel de
  // volume diario que inclui erro mente sobre o negocio.
  it('should not increment GIVEN the use case throws WHEN executed', async () => {
    const inner = { execute: jest.fn().mockRejectedValue(new Error('estoque insuficiente')) };
    const decorated = new MeasuredCreateServiceOrder(inner);

    await expect(decorated.execute({ customerId: 'c1', vehicleId: 'v1' })).rejects.toThrow();

    // O contador nao tem rotulo, entao a serie existe desde a criacao e reset()
    // apenas a zera. O que prova o ponto e o valor continuar em zero, nao a
    // ausencia da serie.
    const metric = await serviceOrdersCreated.get();
    expect(metric.values[0].value).toBe(0);
  });
});
