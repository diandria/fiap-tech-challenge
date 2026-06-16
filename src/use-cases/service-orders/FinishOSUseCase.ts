import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { assertTransition } from '../../entities/serviceOrderStateMachine';
import { findOSOrThrow } from '../utils/serviceOrderUtils';
import { NotifyStatusChangeUseCase } from './NotifyStatusChangeUseCase';

export class FinishOSUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly notifyStatusChange: NotifyStatusChangeUseCase,
  ) {}

  async execute(osId: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    assertTransition(os.status, 'FINISHED');
    const updated = await this.osRepo.update(osId, { status: 'FINISHED', finishedAt: new Date() });
    await this.notifyStatusChange.execute({ osId });
    return updated!;
  }
}
