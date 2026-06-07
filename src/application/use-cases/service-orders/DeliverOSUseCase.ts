import { IServiceOrderRepository } from '../../../use-cases/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../entities/ServiceOrder';
import { assertTransition } from '../../../entities/serviceOrderStateMachine';
import { findOSOrThrow } from '../../utils/serviceOrderUtils';

export class DeliverOSUseCase {
  constructor(private readonly osRepo: IServiceOrderRepository) {}

  async execute(osId: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    assertTransition(os.status, 'DELIVERED');
    const updated = await this.osRepo.update(osId, { status: 'DELIVERED', deliveredAt: new Date() });
    return updated!;
  }
}
