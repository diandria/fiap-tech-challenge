import { GetAvgExecutionTimeUseCase } from '../../../../src/application/use-cases/service-orders/GetAvgExecutionTimeUseCase';
import { IServiceOrderRepository, AvgExecutionResult } from '../../../../src/use-cases/ports/IServiceOrderRepository';

const mockResults: AvgExecutionResult[] = [
  { serviceId: 's-1', avgMinutes: 45.5, count: 4 },
  { serviceId: 's-2', avgMinutes: 20, count: 2 },
];

const makeRepo = (results = mockResults): IServiceOrderRepository => ({
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  getAvgExecutionByService: jest.fn().mockResolvedValue(results),
});

describe('GetAvgExecutionTimeUseCase', () => {
  it('GIVEN completed service history WHEN executed THEN returns avg minutes per serviceId', async () => {
    const repo = makeRepo();
    const useCase = new GetAvgExecutionTimeUseCase(repo);
    const result = await useCase.execute();
    expect(repo.getAvgExecutionByService).toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ serviceId: 's-1', avgMinutes: 45.5, count: 4 });
  });

  it('GIVEN no completed services WHEN executed THEN returns empty array', async () => {
    const repo = makeRepo([]);
    const useCase = new GetAvgExecutionTimeUseCase(repo);
    const result = await useCase.execute();
    expect(result).toEqual([]);
  });
});
