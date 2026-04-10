import { UpdateServiceUseCase } from '../../../../src/application/use-cases/services/UpdateServiceUseCase';
import { IServiceRepository } from '../../../../src/domain/ports/IServiceRepository';
import { Service } from '../../../../src/domain/entities/Service';

const service: Service = { id: 's-1', name: 'Oil Change', price: 80, estimatedMinutes: 30 };

const makeRepo = (result: Service | null): IServiceRepository => ({
  findAll: jest.fn(), findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn().mockResolvedValue(result),
  delete: jest.fn(),
});

describe('UpdateServiceUseCase', () => {
  it('updates and returns the service', async () => {
    const updated = { ...service, price: 100 };
    const repo: IServiceRepository = {
      findAll: jest.fn(), findById: jest.fn(), create: jest.fn(),
      update: jest.fn().mockResolvedValue(updated), delete: jest.fn(),
    };
    const useCase = new UpdateServiceUseCase(repo);
    const result = await useCase.execute('s-1', { price: 100 });
    expect(result.price).toBe(100);
  });

  it('throws NotFoundError when service does not exist', async () => {
    const useCase = new UpdateServiceUseCase(makeRepo(null));
    await expect(useCase.execute('missing', { price: 100 })).rejects.toMatchObject({ statusCode: 404 });
  });
});
