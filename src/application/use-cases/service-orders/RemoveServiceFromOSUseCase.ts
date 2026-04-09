import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { NotFoundError, ValidationError } from '../../../domain/errors/AppError';

export class RemoveServiceFromOSUseCase {
  constructor(private readonly osRepo: IServiceOrderRepository) {}

  async execute(osId: string, serviceId: string): Promise<ServiceOrder> {
    const os = await this.osRepo.findById(osId);
    if (!os) throw new NotFoundError('Service order');
    if (os.status !== 'DIAGNOSIS') throw new ValidationError('Services can only be removed during DIAGNOSIS');

    const exists = os.services.some((s) => s.serviceId === serviceId);
    if (!exists) throw new NotFoundError('Service in order');

    const services = os.services.filter((s) => s.serviceId !== serviceId);
    const updated = await this.osRepo.update(osId, { services });
    return updated!;
  }
}
