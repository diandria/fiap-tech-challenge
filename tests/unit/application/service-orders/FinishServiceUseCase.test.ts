import { FinishServiceUseCase } from '../../../../src/application/use-cases/service-orders/FinishServiceUseCase';
import { makeOSRepo, executionOS } from '../../fixtures/serviceOrder';

const startedAt = new Date();

const executionWithStartedServices = {
  ...executionOS,
  services: [{ serviceId: 's-1', startedAt }, { serviceId: 's-other', startedAt }],
};

describe('FinishServiceUseCase', () => {
  it('GIVEN OS in EXECUTION and started service WHEN execute called THEN records finishedAt on the service', async () => {
    const repo = makeOSRepo(executionWithStartedServices);
    const useCase = new FinishServiceUseCase(repo);
    const result = await useCase.execute('os-1', 's-1');
    expect(result.services[0].finishedAt).toBeDefined();
  });

  it('GIVEN service not yet started WHEN execute called THEN throws ValidationError', async () => {
    const notStarted = {
      ...executionWithStartedServices,
      services: [{ serviceId: 's-1' }, { serviceId: 's-other', startedAt }],
    };
    const useCase = new FinishServiceUseCase(makeOSRepo(notStarted));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN service already finished WHEN execute called THEN throws ValidationError', async () => {
    const alreadyDone = {
      ...executionWithStartedServices,
      services: [{ serviceId: 's-1', startedAt, finishedAt: new Date() }, { serviceId: 's-other', startedAt }],
    };
    const useCase = new FinishServiceUseCase(makeOSRepo(alreadyDone));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN OS not in EXECUTION WHEN execute called THEN throws ValidationError', async () => {
    const wrongOS = { ...executionWithStartedServices, status: 'DIAGNOSIS' as const };
    const useCase = new FinishServiceUseCase(makeOSRepo(wrongOS));
    await expect(useCase.execute('os-1', 's-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new FinishServiceUseCase(makeOSRepo(null));
    await expect(useCase.execute('missing', 's-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN service not in OS WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new FinishServiceUseCase(makeOSRepo(executionWithStartedServices));
    await expect(useCase.execute('os-1', 'not-in-order')).rejects.toMatchObject({ statusCode: 404 });
  });
});
