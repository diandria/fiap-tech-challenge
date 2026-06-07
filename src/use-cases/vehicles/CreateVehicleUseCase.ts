import { IVehicleRepository } from '../ports/IVehicleRepository';
import { Vehicle } from '../../entities/Vehicle';
import { validatePlate } from '../../entities/validators';
import { ValidationError, ConflictError } from '../../entities/errors/AppError';

interface CreateVehicleInput {
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
}

export class CreateVehicleUseCase {
  constructor(private readonly repo: IVehicleRepository) {}

  async execute(input: CreateVehicleInput): Promise<Vehicle> {
    if (!validatePlate(input.plate)) throw new ValidationError('Invalid plate format');
    const existing = await this.repo.findByPlate(input.plate);
    if (existing) throw new ConflictError('Plate already registered');
    return this.repo.create(input);
  }
}
