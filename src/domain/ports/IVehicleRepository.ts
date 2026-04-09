import { Vehicle } from '../entities/Vehicle';

export interface IVehicleRepository {
  findAll(customerId?: string): Promise<Vehicle[]>;
  findById(id: string): Promise<Vehicle | null>;
  findByPlate(plate: string): Promise<Vehicle | null>;
  create(data: Omit<Vehicle, 'id'>): Promise<Vehicle>;
  update(id: string, data: Partial<Omit<Vehicle, 'id'>>): Promise<Vehicle | null>;
  delete(id: string): Promise<boolean>;
}
