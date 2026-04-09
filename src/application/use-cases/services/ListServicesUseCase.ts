import { IServiceRepository } from '../../../domain/ports/IServiceRepository';
import { Service } from '../../../domain/entities/Service';

export class ListServicesUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(): Promise<Service[]> {
    return this.repo.findAll();
  }
}
