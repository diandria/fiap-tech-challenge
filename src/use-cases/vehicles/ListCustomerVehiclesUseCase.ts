import { IVehicleRepository } from '../ports/IVehicleRepository';
import { Vehicle } from '../../entities/Vehicle';

export class ListCustomerVehiclesUseCase {
  constructor(private readonly repo: IVehicleRepository) {}

  async execute(customerId?: string): Promise<Vehicle[]> {
    return this.repo.findAll(customerId);
  }
}
