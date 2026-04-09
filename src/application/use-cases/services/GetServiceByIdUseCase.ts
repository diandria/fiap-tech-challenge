import { IServiceRepository } from '../../../domain/ports/IServiceRepository';
import { Service } from '../../../domain/entities/Service';
import { NotFoundError } from '../../../domain/errors/AppError';

export class GetServiceByIdUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(id: string): Promise<Service> {
    const service = await this.repo.findById(id);
    if (!service) throw new NotFoundError('Service');
    return service;
  }
}
