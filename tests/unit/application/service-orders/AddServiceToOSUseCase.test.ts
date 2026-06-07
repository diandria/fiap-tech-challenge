import { AddServiceToOSUseCase } from '../../../../src/use-cases/service-orders/AddServiceToOSUseCase';
import { makeOSRepo, baseOS } from '../../fixtures/serviceOrder';
import { makeServiceRepo, baseService } from '../../fixtures/service';

describe('AddServiceToOSUseCase', () => {
  it('GIVEN OS in DIAGNOSIS and valid serviceId WHEN execute called THEN adds service to OS', async () => {
    const osRepo = makeOSRepo(baseOS);
    const useCase = new AddServiceToOSUseCase(osRepo, makeServiceRepo(baseService));
    const result = await useCase.execute('os-1', 's-1');
    expect(osRepo.update).toHaveBeenCalledWith('os-1', expect.objectContaining({
      services: [{ serviceId: 's-1' }],
    }));
    expect(result.services).toHaveLength(1);
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new AddServiceToOSUseCase(makeOSRepo(null), makeServiceRepo(baseService));
    await expect(useCase.execute('missing', 's-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN OS not in DIAGNOSIS WHEN execute called THEN throws ValidationError', async () => {
    const wrongOS = { ...baseOS, status: 'RECEIVED' as const };
    const useCase = new AddServiceToOSUseCase(makeOSRepo(wrongOS), makeServiceRepo(baseService));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN non-existing service id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new AddServiceToOSUseCase(makeOSRepo(baseOS), makeServiceRepo(null));
    await expect(useCase.execute('os-1', 'missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN service already in OS WHEN execute called THEN throws ValidationError', async () => {
    const osWithService = { ...baseOS, services: [{ serviceId: 's-1' }] };
    const useCase = new AddServiceToOSUseCase(makeOSRepo(osWithService), makeServiceRepo(baseService));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });
});
