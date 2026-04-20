import { DeleteServiceUseCase } from '../../../../src/application/use-cases/services/DeleteServiceUseCase';
import { makeServiceRepo, baseService } from '../../fixtures/service';

describe('DeleteServiceUseCase', () => {
  it('GIVEN existing service WHEN delete called THEN resolves without error', async () => {
    const repo = makeServiceRepo(baseService);
    const useCase = new DeleteServiceUseCase(repo);
    await expect(useCase.execute('s-1')).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith('s-1');
  });

  it('GIVEN non-existing service WHEN delete called THEN throws NotFoundError', async () => {
    const repo = makeServiceRepo(baseService);
    (repo.delete as jest.Mock).mockResolvedValue(false);
    const useCase = new DeleteServiceUseCase(repo);
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
