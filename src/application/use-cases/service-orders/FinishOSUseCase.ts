import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { NotFoundError } from '../../../domain/errors/AppError';
import { assertTransition } from '../../../domain/serviceOrderStateMachine';

export class FinishOSUseCase {
  constructor(private readonly osRepo: IServiceOrderRepository) {}

  async execute(osId: string): Promise<ServiceOrder> {
    const os = await this.osRepo.findById(osId);
    if (!os) throw new NotFoundError('Service order');
    assertTransition(os.status, 'FINISHED');
    const updated = await this.osRepo.update(osId, { status: 'FINISHED', finishedAt: new Date() });
    return updated!;
  }
}
