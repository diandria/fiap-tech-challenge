import { IServiceRepository } from '../../../domain/ports/IServiceRepository';

export interface ServiceAvgTimeDTO {
  id: string;
  name: string;
  estimatedMinutes: number;
}

export class ListServicesAvgTimeUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(): Promise<ServiceAvgTimeDTO[]> {
    const services = await this.repo.findAll();
    return services
      .map((s) => ({ id: s.id, name: s.name, estimatedMinutes: s.estimatedMinutes }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
