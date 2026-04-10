import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { NotFoundError } from '../../../domain/errors/AppError';
import { assertTransition } from '../../../domain/serviceOrderStateMachine';

export class DeliverOSUseCase {
  constructor(private readonly osRepo: IServiceOrderRepository) {}

  async execute(osId: string): Promise<ServiceOrder> {
    const os = await this.osRepo.findById(osId);
    if (!os) throw new NotFoundError('Service order');
    assertTransition(os.status, 'DELIVERED');
    const updated = await this.osRepo.update(osId, { status: 'DELIVERED', deliveredAt: new Date() });
    return updated!;
  }
}
