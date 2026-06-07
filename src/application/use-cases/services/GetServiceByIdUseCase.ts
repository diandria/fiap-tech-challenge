import { IServiceRepository } from '../../../domain/ports/IServiceRepository';
import { Service } from '../../../entities/Service';
import { NotFoundError } from '../../../entities/errors/AppError';

export class GetServiceByIdUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(id: string): Promise<Service> {
    const service = await this.repo.findById(id);
    if (!service) throw new NotFoundError('Service');
    return service;
  }
}
