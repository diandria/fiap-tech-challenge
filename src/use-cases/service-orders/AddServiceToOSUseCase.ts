import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { IServiceRepository } from '../ports/IServiceRepository';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { NotFoundError, ValidationError } from '../../entities/errors/AppError';
import { findOSOrThrow } from '../utils/serviceOrderUtils';

export class AddServiceToOSUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly serviceRepo: IServiceRepository,
  ) {}

  async execute(osId: string, serviceId: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    if (os.status !== 'DIAGNOSIS') throw new ValidationError('Services can only be added during DIAGNOSIS');

    const service = await this.serviceRepo.findById(serviceId);
    if (!service) throw new NotFoundError('Service');

    const alreadyAdded = os.services.some((s) => s.serviceId === serviceId);
    if (alreadyAdded) throw new ValidationError('Service already added to this order');

    const services = [...os.services, { serviceId }];
    const updated = await this.osRepo.update(osId, { services });
    return updated!;
  }
}
