import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { NotFoundError, ValidationError } from '../../entities/errors/AppError';
import { findOSOrThrow } from '../utils/serviceOrderUtils';

export class StartServiceUseCase {
  constructor(private readonly osRepo: IServiceOrderRepository) {}

  async execute(osId: string, serviceId: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    if (os.status !== 'EXECUTION') throw new ValidationError('OS must be in EXECUTION status');

    const service = os.services.find((s) => s.serviceId === serviceId);
    if (!service) throw new NotFoundError('Service in order');
    if (service.startedAt) throw new ValidationError('Service already started');

    const services = os.services.map((s) =>
      s.serviceId === serviceId ? { ...s, startedAt: new Date() } : s,
    );
    const updated = await this.osRepo.update(osId, { services });
    return updated!;
  }
}
