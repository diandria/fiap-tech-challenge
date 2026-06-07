import { StartServiceUseCase } from '../../../../src/use-cases/service-orders/StartServiceUseCase';
import { makeOSRepo, executionOS } from '../../fixtures/serviceOrder';

const executionWithTwoServices = {
  ...executionOS,
  services: [{ serviceId: 's-1' }, { serviceId: 's-other' }],
};

describe('StartServiceUseCase', () => {
  it('GIVEN OS in EXECUTION and unstarted service WHEN execute called THEN records startedAt on the service', async () => {
    const repo = makeOSRepo(executionWithTwoServices);
    const useCase = new StartServiceUseCase(repo);
    const result = await useCase.execute('os-1', 's-1');
    expect(result.services[0].startedAt).toBeDefined();
  });

  it('GIVEN service already started WHEN execute called THEN throws ValidationError', async () => {
    const alreadyStarted = {
      ...executionWithTwoServices,
      services: [{ serviceId: 's-1', startedAt: new Date() }, { serviceId: 's-other' }],
    };
    const useCase = new StartServiceUseCase(makeOSRepo(alreadyStarted));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN OS not in EXECUTION WHEN execute called THEN throws ValidationError', async () => {
    const wrongOS = { ...executionWithTwoServices, status: 'DIAGNOSIS' as const };
    const useCase = new StartServiceUseCase(makeOSRepo(wrongOS));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new StartServiceUseCase(makeOSRepo(null));
    await expect(useCase.execute('missing', 's-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN service not in OS WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new StartServiceUseCase(makeOSRepo(executionWithTwoServices));
    await expect(useCase.execute('os-1', 'not-in-order')).rejects.toMatchObject({ statusCode: 404 });
  });
});
