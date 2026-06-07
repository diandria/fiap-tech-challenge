import { IVehicleRepository } from '../ports/IVehicleRepository';
import { Vehicle } from '../../entities/Vehicle';
import { NotFoundError } from '../../entities/errors/AppError';

export class GetVehicleByIdUseCase {
  constructor(private readonly repo: IVehicleRepository) {}

  async execute(id: string): Promise<Vehicle> {
    const vehicle = await this.repo.findById(id);
    if (!vehicle) throw new NotFoundError('Vehicle');
    return vehicle;
  }
}
