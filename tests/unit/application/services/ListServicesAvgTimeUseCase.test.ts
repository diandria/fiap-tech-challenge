import { ListServicesAvgTimeUseCase } from '../../../../src/use-cases/services/ListServicesAvgTimeUseCase';
import { IServiceRepository } from '../../../../src/use-cases/ports/IServiceRepository';
import { Service } from '../../../../src/entities/Service';

const makeRepo = (services: Service[]): IServiceRepository => ({
  findAll: jest.fn().mockResolvedValue(services),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

describe('ListServicesAvgTimeUseCase', () => {
  it('GIVEN no services WHEN execute called THEN returns empty array', async () => {
    const repo = makeRepo([]);
    const useCase = new ListServicesAvgTimeUseCase(repo);

    const result = await useCase.execute();

    expect(repo.findAll).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('GIVEN services exist WHEN execute called THEN returns only id, name and estimatedMinutes', async () => {
    const repo = makeRepo([
      { id: 's-1', name: 'Oil Change', price: 80, estimatedMinutes: 30 },
    ]);
    const useCase = new ListServicesAvgTimeUseCase(repo);

    const result = await useCase.execute();

    expect(result).toEqual([
      { id: 's-1', name: 'Oil Change', estimatedMinutes: 30 },
    ]);
    expect(result[0]).not.toHaveProperty('price');
  });

  it('GIVEN services out of order WHEN execute called THEN returns sorted by name ascending', async () => {
    const repo = makeRepo([
      { id: 's-2', name: 'Wheel Alignment', price: 120, estimatedMinutes: 45 },
      { id: 's-1', name: 'Oil Change', price: 80, estimatedMinutes: 30 },
      { id: 's-3', name: 'Brake Inspection', price: 60, estimatedMinutes: 20 },
    ]);
    const useCase = new ListServicesAvgTimeUseCase(repo);

    const result = await useCase.execute();

    expect(result.map((s) => s.name)).toEqual([
      'Brake Inspection',
      'Oil Change',
      'Wheel Alignment',
    ]);
  });
});
