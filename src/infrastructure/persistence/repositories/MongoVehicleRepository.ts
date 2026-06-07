import { IVehicleRepository } from '../../../use-cases/ports/IVehicleRepository';
import { Vehicle } from '../../../entities/Vehicle';
import { VehicleModel } from '../models/VehicleModel';

export class MongoVehicleRepository implements IVehicleRepository {
  private toEntity(doc: any): Vehicle {
    return {
      id: doc._id.toString(),
      customerId: doc.customerId,
      plate: doc.plate,
      brand: doc.brand,
      model: doc.vehicleModel,
      year: doc.year,
    };
  }

  async findAll(customerId?: string): Promise<Vehicle[]> {
    const query = customerId ? { customerId } : {};
    const docs = await VehicleModel.find(query).lean();
    return docs.map((d) => this.toEntity(d));
  }

  async findById(id: string): Promise<Vehicle | null> {
    const doc = await VehicleModel.findById(id).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByPlate(plate: string): Promise<Vehicle | null> {
    const doc = await VehicleModel.findOne({ plate: plate.toUpperCase() }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async create(data: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    const { model: vehicleModel, ...rest } = data;
    const doc = await VehicleModel.create({ ...rest, vehicleModel });
    return this.toEntity(doc.toObject());
  }

  async update(id: string, data: Partial<Omit<Vehicle, 'id'>>): Promise<Vehicle | null> {
    const { model: vehicleModel, ...rest } = data;
    const updateData = vehicleModel !== undefined ? { ...rest, vehicleModel } : rest;
    const doc = await VehicleModel.findByIdAndUpdate(id, updateData, { new: true }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await VehicleModel.findByIdAndDelete(id);
    return result !== null;
  }
}
