import { IVehicleRepository } from '../../../domain/ports/IVehicleRepository';
import { Vehicle } from '../../../domain/entities/Vehicle';

export class ListVehiclesUseCase {
  constructor(private readonly repo: IVehicleRepository) {}

  async execute(customerId?: string): Promise<Vehicle[]> {
    return this.repo.findAll(customerId);
  }
}
