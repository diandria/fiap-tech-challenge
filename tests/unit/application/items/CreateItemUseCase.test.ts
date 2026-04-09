import { CreateItemUseCase } from '../../../../src/application/use-cases/items/CreateItemUseCase';
import { IItemRepository } from '../../../../src/domain/ports/IItemRepository';

const makeRepo = (override?: Partial<IItemRepository>): IItemRepository => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'i-1', ...data })),
  update: jest.fn(),
  delete: jest.fn(),
  ...override,
});

describe('CreateItemUseCase', () => {
  it('creates an item with reservedQuantity defaulting to 0', async () => {
    const useCase = new CreateItemUseCase(makeRepo());
    const result = await useCase.execute({ name: 'Oil Filter', price: 25.0, stockQuantity: 10 });
    expect(result.reservedQuantity).toBe(0);
    expect(result.stockQuantity).toBe(10);
  });

  it('throws ValidationError for negative stockQuantity', async () => {
    const useCase = new CreateItemUseCase(makeRepo());
    await expect(useCase.execute({ name: 'Filter', price: 10, stockQuantity: -1 }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws ValidationError for negative price', async () => {
    const useCase = new CreateItemUseCase(makeRepo());
    await expect(useCase.execute({ name: 'Filter', price: -5, stockQuantity: 5 }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
