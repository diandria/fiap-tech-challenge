import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { assertTransition } from '../../entities/serviceOrderStateMachine';
import { findOSOrThrow } from '../utils/serviceOrderUtils';
import { IStatusChangeNotifier } from '../ports/IStatusChangeNotifier';
import { IChangeServiceOrderStatus } from '../ports/input/IChangeServiceOrderStatus';

export class StartDiagnosisUseCase implements IChangeServiceOrderStatus {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly notifyStatusChange: IStatusChangeNotifier,
  ) {}

  async execute(osId: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    assertTransition(os.status, 'DIAGNOSIS');
    const updated = await this.osRepo.update(osId, { status: 'DIAGNOSIS' });
    await this.notifyStatusChange.execute({ osId });
    return updated!;
  }
}
