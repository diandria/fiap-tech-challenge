import { IVehicleRepository } from '../../../domain/ports/IVehicleRepository';
import { Vehicle } from '../../../domain/entities/Vehicle';
import { validatePlate } from '../../../domain/validators';
import { ValidationError, ConflictError } from '../../../domain/errors/AppError';

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
