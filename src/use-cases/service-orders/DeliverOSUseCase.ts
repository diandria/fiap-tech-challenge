import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { assertTransition } from '../../entities/serviceOrderStateMachine';
import { findOSOrThrow } from '../utils/serviceOrderUtils';
import { NotifyStatusChangeUseCase } from './NotifyStatusChangeUseCase';

export class DeliverOSUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly notifyStatusChange: NotifyStatusChangeUseCase,
  ) {}

  async execute(osId: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    assertTransition(os.status, 'DELIVERED');
    const updated = await this.osRepo.update(osId, { status: 'DELIVERED', deliveredAt: new Date() });
    await this.notifyStatusChange.execute({ osId });
    return updated!;
  }
}
