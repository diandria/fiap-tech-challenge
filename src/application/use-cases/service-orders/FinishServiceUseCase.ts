import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../entities/ServiceOrder';
import { NotFoundError, ValidationError } from '../../../entities/errors/AppError';
import { findOSOrThrow } from '../../utils/serviceOrderUtils';

export class FinishServiceUseCase {
  constructor(private readonly osRepo: IServiceOrderRepository) {}

  async execute(osId: string, serviceId: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    if (os.status !== 'EXECUTION') throw new ValidationError('OS must be in EXECUTION status');

    const svc = os.services.find((s) => s.serviceId === serviceId);
    if (!svc) throw new NotFoundError('Service in order');
    if (!svc.startedAt) throw new ValidationError('Service has not been started');
    if (svc.finishedAt) throw new ValidationError('Service already finished');

    const services = os.services.map((s) =>
      s.serviceId === serviceId ? { ...s, finishedAt: new Date() } : s,
    );
    const updated = await this.osRepo.update(osId, { services });
    return updated!;
  }
}
