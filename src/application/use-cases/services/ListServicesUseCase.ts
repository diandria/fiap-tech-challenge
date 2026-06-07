import { IServiceRepository } from '../../../use-cases/ports/IServiceRepository';
import { Service } from '../../../entities/Service';

export class ListServicesUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(): Promise<Service[]> {
    return this.repo.findAll();
  }
}
