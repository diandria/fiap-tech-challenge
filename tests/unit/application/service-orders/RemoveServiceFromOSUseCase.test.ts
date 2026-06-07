import { RemoveServiceFromOSUseCase } from '../../../../src/use-cases/service-orders/RemoveServiceFromOSUseCase';
import { makeOSRepo, baseOS } from '../../fixtures/serviceOrder';

const osWithService = { ...baseOS, services: [{ serviceId: 's-1' }] };

describe('RemoveServiceFromOSUseCase', () => {
  it('GIVEN OS in DIAGNOSIS with service WHEN execute called THEN removes service from OS', async () => {
    const repo = makeOSRepo(osWithService);
    const useCase = new RemoveServiceFromOSUseCase(repo);
    await useCase.execute('os-1', 's-1');
    expect(repo.update).toHaveBeenCalledWith('os-1', { services: [] });
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new RemoveServiceFromOSUseCase(makeOSRepo(null));
    await expect(useCase.execute('missing', 's-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN OS not in DIAGNOSIS WHEN execute called THEN throws ValidationError', async () => {
    const wrongOS = { ...osWithService, status: 'RECEIVED' as const };
    const useCase = new RemoveServiceFromOSUseCase(makeOSRepo(wrongOS));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN service not in OS WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new RemoveServiceFromOSUseCase(makeOSRepo(osWithService));
    await expect(useCase.execute('os-1', 'not-in-order')).rejects.toMatchObject({ statusCode: 404 });
  });
});
