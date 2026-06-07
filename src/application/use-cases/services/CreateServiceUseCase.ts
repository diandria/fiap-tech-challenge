import { IServiceRepository } from '../../../use-cases/ports/IServiceRepository';
import { Service } from '../../../entities/Service';

export class CreateServiceUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(data: Omit<Service, 'id'>): Promise<Service> {
    return this.repo.create(data);
  }
}
