import { CreateServiceUseCase } from '../../../../src/application/use-cases/services/CreateServiceUseCase';
import { IServiceRepository } from '../../../../src/domain/ports/IServiceRepository';
import { Service } from '../../../../src/domain/entities/Service';

const created: Service = { id: 's-1', name: 'Oil Change', price: 80, estimatedMinutes: 30 };

const makeRepo = (): IServiceRepository => ({
  findAll: jest.fn(), findById: jest.fn(),
  create: jest.fn().mockResolvedValue(created),
  update: jest.fn(), delete: jest.fn(),
});

describe('CreateServiceUseCase', () => {
  it('creates and returns a service', async () => {
    const repo = makeRepo();
    const useCase = new CreateServiceUseCase(repo);
    const result = await useCase.execute({ name: 'Oil Change', price: 80, estimatedMinutes: 30 });
    expect(repo.create).toHaveBeenCalledWith({ name: 'Oil Change', price: 80, estimatedMinutes: 30 });
    expect(result.id).toBe('s-1');
  });
});
