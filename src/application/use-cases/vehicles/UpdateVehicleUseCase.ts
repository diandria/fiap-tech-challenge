import { IVehicleRepository } from '../../../use-cases/ports/IVehicleRepository';
import { Vehicle } from '../../../entities/Vehicle';
import { validatePlate } from '../../../entities/validators';
import { NotFoundError, ValidationError, ConflictError } from '../../../entities/errors/AppError';

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
