import { buildBudgetLines } from '../../../../src/use-cases/saga/buildBudgetLines';
import { NotFoundError } from '../../../../src/entities/errors/AppError';
import { baseOS } from '../../fixtures/serviceOrder';
import { baseService } from '../../fixtures/service';
import { stockedItem } from '../../fixtures/item';

const order = { ...baseOS, services: [{ serviceId: 's-1' }], items: [{ itemId: 'i-1', quantity: 3 }] };

describe('buildBudgetLines', () => {
  it('prices services at quantity one and items at the ordered quantity', () => {
    expect(buildBudgetLines(order, [baseService], [stockedItem])).toEqual([
      { kind: 'SERVICE', referenceId: 's-1', description: 'Oil Change', unitPrice: 80, quantity: 1 },
      { kind: 'ITEM', referenceId: 'i-1', description: 'Oil Filter', unitPrice: 25, quantity: 3 },
    ]);
  });

  it('throws NotFoundError when a catalog entry is missing', () => {
    expect(() => buildBudgetLines(order, [], [stockedItem])).toThrow(NotFoundError);
    expect(() => buildBudgetLines(order, [baseService], [])).toThrow(NotFoundError);
  });

  it('returns no lines for an order without services or items', () => {
    expect(buildBudgetLines(baseOS, [], [])).toEqual([]);
  });
});
