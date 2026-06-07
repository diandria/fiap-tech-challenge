import { UpdateServiceUseCase } from '../../../../src/use-cases/services/UpdateServiceUseCase';
import { makeServiceRepo, baseService } from '../../fixtures/service';

describe('UpdateServiceUseCase', () => {
  it('GIVEN existing service WHEN update called THEN returns updated service', async () => {
    const repo = makeServiceRepo(baseService);
    const useCase = new UpdateServiceUseCase(repo);
    const result = await useCase.execute('s-1', { price: 100 });
    expect(result.price).toBe(100);
  });

  it('GIVEN non-existing service WHEN update called THEN throws NotFoundError', async () => {
    const useCase = new UpdateServiceUseCase(makeServiceRepo(null));
    await expect(useCase.execute('missing', { price: 100 })).rejects.toMatchObject({ statusCode: 404 });
  });
});
