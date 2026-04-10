import { GetServiceByIdUseCase } from '../../../../src/application/use-cases/services/GetServiceByIdUseCase';
import { IServiceRepository } from '../../../../src/domain/ports/IServiceRepository';
import { Service } from '../../../../src/domain/entities/Service';

const service: Service = { id: 's-1', name: 'Oil Change', price: 80, estimatedMinutes: 30 };

const makeRepo = (result: Service | null): IServiceRepository => ({
  findAll: jest.fn(), findById: jest.fn().mockResolvedValue(result),
  create: jest.fn(), update: jest.fn(), delete: jest.fn(),
});

describe('GetServiceByIdUseCase', () => {
  it('returns the service when found', async () => {
    const useCase = new GetServiceByIdUseCase(makeRepo(service));
    const result = await useCase.execute('s-1');
    expect(result.id).toBe('s-1');
  });

  it('throws NotFoundError when service does not exist', async () => {
    const useCase = new GetServiceByIdUseCase(makeRepo(null));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
