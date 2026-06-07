import { StartDiagnosisUseCase } from '../../../../src/use-cases/service-orders/StartDiagnosisUseCase';
import { makeOSRepo, receivedOS, finishedOS } from '../../fixtures/serviceOrder';

describe('StartDiagnosisUseCase', () => {
  it('GIVEN OS in RECEIVED status WHEN execute called THEN transitions to DIAGNOSIS', async () => {
    const repo = makeOSRepo(receivedOS);
    const useCase = new StartDiagnosisUseCase(repo);
    const result = await useCase.execute('os-1');
    expect(repo.update).toHaveBeenCalledWith('os-1', { status: 'DIAGNOSIS' });
    expect(result.status).toBe('DIAGNOSIS');
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new StartDiagnosisUseCase(makeOSRepo(null));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN OS not in RECEIVED status WHEN execute called THEN throws ValidationError', async () => {
    const wrongOS = { ...finishedOS, status: 'DELIVERED' as const };
    const useCase = new StartDiagnosisUseCase(makeOSRepo(wrongOS));
    await expect(useCase.execute('os-1')).rejects.toMatchObject({ statusCode: 400 });
  });
});
