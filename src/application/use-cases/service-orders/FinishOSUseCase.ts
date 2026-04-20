import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { assertTransition } from '../../../domain/serviceOrderStateMachine';
import { findOSOrThrow } from '../../utils/serviceOrderUtils';

export class FinishOSUseCase {
  constructor(private readonly osRepo: IServiceOrderRepository) {}

  async execute(osId: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    assertTransition(os.status, 'FINISHED');
    const updated = await this.osRepo.update(osId, { status: 'FINISHED', finishedAt: new Date() });
    return updated!;
  }
}
