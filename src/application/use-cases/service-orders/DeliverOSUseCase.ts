import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { assertTransition } from '../../../domain/serviceOrderStateMachine';
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
