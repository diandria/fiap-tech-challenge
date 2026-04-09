import { IVehicleRepository } from '../../../domain/ports/IVehicleRepository';
import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { Vehicle } from '../../../domain/entities/Vehicle';
import { validatePlate } from '../../../domain/validators';
import { ValidationError, ConflictError, NotFoundError } from '../../../domain/errors/AppError';

interface CreateVehicleInput {
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
}

export class CreateVehicleUseCase {
  constructor(
    private readonly repo: IVehicleRepository,
    private readonly customerRepo: ICustomerRepository,
  ) {}

  async execute(input: CreateVehicleInput): Promise<Vehicle> {
    const customer = await this.customerRepo.findById(input.customerId);
    if (!customer) throw new NotFoundError('Customer');
    if (!validatePlate(input.plate)) throw new ValidationError('Invalid plate format');
    const existing = await this.repo.findByPlate(input.plate);
    if (existing) throw new ConflictError('Plate already registered');
    return this.repo.create(input);
  }
}
