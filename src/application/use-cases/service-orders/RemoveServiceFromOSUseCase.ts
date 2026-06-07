import { IServiceOrderRepository } from '../../../use-cases/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../entities/ServiceOrder';
import { NotFoundError, ValidationError } from '../../../entities/errors/AppError';
import { findOSOrThrow } from '../../utils/serviceOrderUtils';

export class RemoveServiceFromOSUseCase {
  constructor(private readonly osRepo: IServiceOrderRepository) {}

  async execute(osId: string, serviceId: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    if (os.status !== 'DIAGNOSIS') throw new ValidationError('Services can only be removed during DIAGNOSIS');

    const exists = os.services.some((s) => s.serviceId === serviceId);
    if (!exists) throw new NotFoundError('Service in order');

    const services = os.services.filter((s) => s.serviceId !== serviceId);
    const updated = await this.osRepo.update(osId, { services });
    return updated!;
  }
}
