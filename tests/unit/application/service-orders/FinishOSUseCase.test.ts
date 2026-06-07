import { FinishOSUseCase } from '../../../../src/use-cases/service-orders/FinishOSUseCase';
import { makeOSRepo, executionOS } from '../../fixtures/serviceOrder';

describe('FinishOSUseCase', () => {
  it('GIVEN OS in EXECUTION WHEN execute called THEN transitions to FINISHED and records finishedAt', async () => {
    const repo = makeOSRepo(executionOS);
    const useCase = new FinishOSUseCase(repo);
    const result = await useCase.execute('os-1');
    expect(result.status).toBe('FINISHED');
    expect(result.finishedAt).toBeDefined();
  });

  it('GIVEN OS not in EXECUTION WHEN execute called THEN throws ValidationError', async () => {
    const wrongOS = { ...executionOS, status: 'RECEIVED' as const };
    const useCase = new FinishOSUseCase(makeOSRepo(wrongOS));
    await expect(useCase.execute('os-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new FinishOSUseCase(makeOSRepo(null));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
