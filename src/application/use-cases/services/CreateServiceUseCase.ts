import { IServiceRepository } from '../../../domain/ports/IServiceRepository';
import { Service } from '../../../domain/entities/Service';

export class CreateServiceUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(data: Omit<Service, 'id'>): Promise<Service> {
    return this.repo.create(data);
  }
}
