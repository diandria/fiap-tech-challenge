import { IServiceRepository } from '../../../domain/ports/IServiceRepository';
import { NotFoundError } from '../../../entities/errors/AppError';

export class DeleteServiceUseCase {
  constructor(private readonly repo: IServiceRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundError('Service');
  }
}
