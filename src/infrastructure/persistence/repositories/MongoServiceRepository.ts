import { IServiceRepository } from '../../../use-cases/ports/IServiceRepository';
import { Service } from '../../../entities/Service';
import { ServiceModel } from '../../../frameworks/database/models/ServiceModel';

export class MongoServiceRepository implements IServiceRepository {
  private toEntity(doc: any): Service {
    return {
      id: doc._id.toString(),
      name: doc.name,
      price: doc.price,
      estimatedMinutes: doc.estimatedMinutes,
    };
  }

  async findAll(): Promise<Service[]> {
    const docs = await ServiceModel.find().lean();
    return docs.map((d) => this.toEntity(d));
  }

  async findById(id: string): Promise<Service | null> {
    const doc = await ServiceModel.findById(id).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async create(data: Omit<Service, 'id'>): Promise<Service> {
    const doc = await ServiceModel.create(data);
    return this.toEntity(doc.toObject());
  }

  async update(id: string, data: Partial<Omit<Service, 'id'>>): Promise<Service | null> {
    const doc = await ServiceModel.findByIdAndUpdate(id, data, { new: true }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await ServiceModel.findByIdAndDelete(id);
    return result !== null;
  }
}
