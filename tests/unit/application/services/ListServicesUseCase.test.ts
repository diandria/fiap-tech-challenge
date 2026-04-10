import { ListServicesUseCase } from '../../../../src/application/use-cases/services/ListServicesUseCase';
import { IServiceRepository } from '../../../../src/domain/ports/IServiceRepository';
import { Service } from '../../../../src/domain/entities/Service';

const services: Service[] = [{ id: 's-1', name: 'Oil Change', price: 80, estimatedMinutes: 30 }];

const makeRepo = (): IServiceRepository => ({
  findAll: jest.fn().mockResolvedValue(services),
  findById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

describe('ListServicesUseCase', () => {
  it('returns all services', async () => {
    const repo = makeRepo();
    const useCase = new ListServicesUseCase(repo);
    const result = await useCase.execute();
    expect(repo.findAll).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});
