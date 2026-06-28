import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { IBudgetCalculator } from '../ports/IBudgetCalculator';
import { IStatusChangeNotifier } from '../ports/IStatusChangeNotifier';
import { IBudgetNotifier } from '../ports/IBudgetNotifier';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { assertTransition } from '../../entities/serviceOrderStateMachine';
import { findOSOrThrow } from '../utils/serviceOrderUtils';

export class FinishDiagnosisUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly notifyStatusChange: IStatusChangeNotifier,
    private readonly notifyBudget: IBudgetNotifier,
    private readonly calculateBudget: IBudgetCalculator,
  ) {}

  async execute(osId: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    assertTransition(os.status, 'WAITING_APPROVAL');

    const budgetTotal = await this.calculateBudget.execute(os);

    const updated = await this.osRepo.update(osId, {
      status: 'WAITING_APPROVAL',
      budgetTotal,
    });

    await this.notifyStatusChange.execute({ osId });
    await this.notifyBudget.execute({ osId });

    return updated!;
  }
}
