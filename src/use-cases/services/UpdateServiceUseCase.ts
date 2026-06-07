import { IServiceRepository } from '../ports/IServiceRepository';
import { Service } from '../../entities/Service';
import { NotFoundError } from '../../entities/errors/AppError';

export class UpdateServiceUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(id: string, data: Partial<Omit<Service, 'id'>>): Promise<Service> {
    const updated = await this.repo.update(id, data);
    if (!updated) throw new NotFoundError('Service');
    return updated;
  }
}
