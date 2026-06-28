import { CalculateBudgetUseCase } from '../../../../src/use-cases/service-orders/CalculateBudgetUseCase';
import { IServiceRepository } from '../../../../src/use-cases/ports/IServiceRepository';
import { baseOS } from '../../fixtures/serviceOrder';
import { makeItemRepo, stockedItem } from '../../fixtures/item';
import { baseService } from '../../fixtures/service';

const diagnosisOS = {
  ...baseOS,
  status: 'DIAGNOSIS' as const,
  services: [{ serviceId: 's-1' }, { serviceId: 's-2' }],
  items: [{ itemId: 'i-1', quantity: 2 }],
};

const makeServiceRepo = (): IServiceRepository => ({
  findAll: jest.fn(),
  findById: jest.fn()
    .mockResolvedValueOnce(baseService)
    .mockResolvedValueOnce({ ...baseService, id: 's-2', name: 'Tire Rotation', price: 50, estimatedMinutes: 20 }),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

describe('CalculateBudgetUseCase', () => {
  it('GIVEN OS with services and items WHEN execute called THEN returns sum of service prices and item totals', async () => {
    // baseService.price = 80, second service price = 50, item price = 25 * quantity 2 = 50
    const itemRepo = makeItemRepo({ ...stockedItem, price: 25 });
    const useCase = new CalculateBudgetUseCase(makeServiceRepo(), itemRepo);
    const result = await useCase.execute(diagnosisOS);
    expect(result).toBe(180);
  });

  it('GIVEN OS with no services or items WHEN execute called THEN returns 0', async () => {
    const emptyRepo: IServiceRepository = {
      findAll: jest.fn(), findById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(),
    };
    const useCase = new CalculateBudgetUseCase(emptyRepo, makeItemRepo());
    const result = await useCase.execute({ ...baseOS, services: [], items: [] });
    expect(result).toBe(0);
  });

  it('GIVEN OS with service not found in catalog WHEN execute called THEN skips it and does not add to total', async () => {
    const nullServiceRepo: IServiceRepository = {
      findAll: jest.fn(), findById: jest.fn().mockResolvedValue(null),
      create: jest.fn(), update: jest.fn(), delete: jest.fn(),
    };
    const useCase = new CalculateBudgetUseCase(nullServiceRepo, makeItemRepo());
    const result = await useCase.execute({ ...baseOS, services: [{ serviceId: 'missing' }], items: [] });
    expect(result).toBe(0);
  });

  it('GIVEN OS with item not found in catalog WHEN execute called THEN skips it and does not add to total', async () => {
    const useCase = new CalculateBudgetUseCase(makeServiceRepo(), makeItemRepo(null));
    const result = await useCase.execute({ ...baseOS, services: [], items: [{ itemId: 'missing', quantity: 3 }] });
    expect(result).toBe(0);
  });
});
