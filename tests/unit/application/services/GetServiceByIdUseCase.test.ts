import { GetServiceByIdUseCase } from '../../../../src/use-cases/services/GetServiceByIdUseCase';
import { makeServiceRepo, baseService } from '../../fixtures/service';

describe('GetServiceByIdUseCase', () => {
  it('GIVEN existing service id WHEN execute called THEN returns the service', async () => {
    const useCase = new GetServiceByIdUseCase(makeServiceRepo(baseService));
    const result = await useCase.execute('s-1');
    expect(result.id).toBe('s-1');
  });

  it('GIVEN unknown id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new GetServiceByIdUseCase(makeServiceRepo(null));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
