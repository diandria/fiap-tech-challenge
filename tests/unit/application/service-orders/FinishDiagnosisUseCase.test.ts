import { FinishDiagnosisUseCase } from '../../../../src/use-cases/service-orders/FinishDiagnosisUseCase';
import { IStatusChangeNotifier } from '../../../../src/use-cases/ports/IStatusChangeNotifier';
import { IBudgetNotifier } from '../../../../src/use-cases/ports/IBudgetNotifier';
import { IBudgetCalculator } from '../../../../src/use-cases/ports/IBudgetCalculator';
import { makeOSRepo, baseOS } from '../../fixtures/serviceOrder';

const diagnosisOS = {
  ...baseOS,
  status: 'DIAGNOSIS' as const,
  services: [{ serviceId: 's-1' }, { serviceId: 's-2' }],
  items: [{ itemId: 'i-1', quantity: 2 }],
};

const makeNotifyStatusChange = (): IStatusChangeNotifier => ({
  execute: jest.fn().mockResolvedValue(undefined),
});

const makeNotifyBudget = (): IBudgetNotifier => ({
  execute: jest.fn().mockResolvedValue(undefined),
});

const makeBudgetCalculator = (total: number): IBudgetCalculator => ({
  execute: jest.fn().mockResolvedValue(total),
});

describe('FinishDiagnosisUseCase', () => {
  it('GIVEN OS in DIAGNOSIS WHEN execute called THEN delegates budget calculation and transitions to WAITING_APPROVAL', async () => {
    const osRepo = makeOSRepo(diagnosisOS);
    const useCase = new FinishDiagnosisUseCase(
      osRepo, makeNotifyStatusChange(), makeNotifyBudget(), makeBudgetCalculator(180),
    );
    const result = await useCase.execute('os-1');
    expect(result.budgetTotal).toBe(180);
    expect(result.status).toBe('WAITING_APPROVAL');
  });

  it('GIVEN OS not in DIAGNOSIS WHEN execute called THEN throws ValidationError', async () => {
    const osRepo = makeOSRepo({ ...diagnosisOS, status: 'RECEIVED' });
    const useCase = new FinishDiagnosisUseCase(
      osRepo, makeNotifyStatusChange(), makeNotifyBudget(), makeBudgetCalculator(0),
    );
    await expect(useCase.execute('os-1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('GIVEN non-existing OS id WHEN execute called THEN throws NotFoundError', async () => {
    const useCase = new FinishDiagnosisUseCase(
      makeOSRepo(null), makeNotifyStatusChange(), makeNotifyBudget(), makeBudgetCalculator(0),
    );
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('GIVEN OS in DIAGNOSIS WHEN execute called THEN notifyStatusChange and notifyBudget are both invoked', async () => {
    const notifyStatusChange = makeNotifyStatusChange();
    const notifyBudget = makeNotifyBudget();
    const useCase = new FinishDiagnosisUseCase(
      makeOSRepo(diagnosisOS), notifyStatusChange, notifyBudget, makeBudgetCalculator(180),
    );
    await useCase.execute('os-1');
    expect(notifyStatusChange.execute).toHaveBeenCalledWith({ osId: 'os-1' });
    expect(notifyBudget.execute).toHaveBeenCalledWith({ osId: 'os-1' });
  });
});
