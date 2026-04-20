import { CreateServiceUseCase } from '../../../../src/application/use-cases/services/CreateServiceUseCase';
import { makeServiceRepo, baseService } from '../../fixtures/service';

describe('CreateServiceUseCase', () => {
  it('GIVEN valid service data WHEN execute called THEN creates and returns service', async () => {
    const repo = makeServiceRepo(baseService);
    const useCase = new CreateServiceUseCase(repo);
    const result = await useCase.execute({
      name: baseService.name,
      price: baseService.price,
      estimatedMinutes: baseService.estimatedMinutes,
    });
    expect(repo.create).toHaveBeenCalledWith({
      name: baseService.name,
      price: baseService.price,
      estimatedMinutes: baseService.estimatedMinutes,
    });
    expect(result.id).toBe('s-1');
  });
});
