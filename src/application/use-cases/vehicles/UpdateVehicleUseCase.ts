import { IVehicleRepository } from '../../../domain/ports/IVehicleRepository';
import { Vehicle } from '../../../domain/entities/Vehicle';
import { validatePlate } from '../../../domain/validators';
import { NotFoundError, ValidationError, ConflictError } from '../../../domain/errors/AppError';

export class UpdateVehicleUseCase {
  constructor(private readonly repo: IVehicleRepository) {}

  async execute(id: string, data: Partial<Omit<Vehicle, 'id'>>): Promise<Vehicle> {
    if (data.plate !== undefined) {
      if (!validatePlate(data.plate)) throw new ValidationError('Invalid plate format');
      const existing = await this.repo.findByPlate(data.plate);
      if (existing && existing.id !== id) throw new ConflictError('Plate already registered');
    }
    const updated = await this.repo.update(id, data);
    if (!updated) throw new NotFoundError('Vehicle');
    return updated;
  }
}
