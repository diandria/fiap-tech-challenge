import { IVehicleRepository } from '../../../use-cases/ports/IVehicleRepository';
import { NotFoundError } from '../../../entities/errors/AppError';

export class DeleteVehicleUseCase {
  constructor(private readonly repo: IVehicleRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.repo.delete(id);
    if (!deleted) throw new NotFoundError('Vehicle');
  }
}
