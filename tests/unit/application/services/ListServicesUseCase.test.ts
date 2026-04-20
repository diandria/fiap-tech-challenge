import { ListServicesUseCase } from '../../../../src/application/use-cases/services/ListServicesUseCase';
import { makeServiceRepo, baseService } from '../../fixtures/service';

describe('ListServicesUseCase', () => {
  it('GIVEN services exist WHEN execute called THEN returns service array', async () => {
    const repo = makeServiceRepo(baseService);
    const useCase = new ListServicesUseCase(repo);
    const result = await useCase.execute();
    expect(repo.findAll).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});
