import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { NotFoundError } from '../../../domain/errors/AppError';

export class GetServiceOrderUseCase {
  constructor(private readonly repo: IServiceOrderRepository) {}

  async execute(id: string): Promise<ServiceOrder> {
    const os = await this.repo.findById(id);
    if (!os) throw new NotFoundError('Service order');
    return os;
  }
}
