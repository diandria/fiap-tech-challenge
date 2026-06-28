import { StartDiagnosisUseCase } from '../../../../src/use-cases/service-orders/StartDiagnosisUseCase';
import { IStatusChangeNotifier } from '../../../../src/use-cases/ports/IStatusChangeNotifier';
import { makeOSRepo, receivedOS, finishedOS } from '../../fixtures/serviceOrder';

const makeNotifyStatusChange = (): IStatusChangeNotifier => ({
  execute: jest.fn().mockResolvedValue(undefined),
});

describe('StartDiagnosisUseCase', () => {
  it('GIVEN OS in RECEIVED status WHEN execute called THEN transitions to DIAGNOSIS', async () => {
    const repo = makeOSRepo(receivedOS);
    const useCase = new StartDiagnosisUseCase(repo, makeNotifyStatusChange());
    const result = await useCase.execute('os-1');
    expect(repo.update).toHaveBeenCalledWith('os-1', { status: 'DIAGNOSIS' });
    expect(result.status).toBe('DIAGNOSIS');
  });

  it('GIVEN OS transitions to DIAGNOSIS WHEN execute called THEN notifyStatusChange is invoked', async () => {
    const repo = makeOSRepo(receivedOS);
    const notifyStatusChange = makeNotifyStatusChange();
    const useCase = new StartDiagnosisUseCase(repo, notifyStatusChange);
    await useCase.execute('os-1');
    expect(notifyStatusChange.execute).toHaveBeenCalledWith({ osId: 'os-1' });
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new StartDiagnosisUseCase(makeOSRepo(null), makeNotifyStatusChange());
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN OS not in RECEIVED status WHEN execute called THEN throws ValidationError', async () => {
    const wrongOS = { ...finishedOS, status: 'DELIVERED' as const };
    const useCase = new StartDiagnosisUseCase(makeOSRepo(wrongOS), makeNotifyStatusChange());
    await expect(useCase.execute('os-1')).rejects.toMatchObject({ statusCode: 400 });
  });
});
