import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { Customer } from '../../../domain/entities/Customer';
import { CustomerModel } from '../models/CustomerModel';

export class MongoCustomerRepository implements ICustomerRepository {
  private toEntity(doc: any): Customer {
    return {
      id: doc._id.toString(),
      name: doc.name,
      cpfCnpj: doc.cpfCnpj,
      email: doc.email,
      phone: doc.phone,
    };
  }

  async findAll(): Promise<Customer[]> {
    const docs = await CustomerModel.find().lean();
    return docs.map((d) => this.toEntity(d));
  }

  async findById(id: string): Promise<Customer | null> {
    const doc = await CustomerModel.findById(id).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByCpfCnpj(cpfCnpj: string): Promise<Customer | null> {
    const doc = await CustomerModel.findOne({ cpfCnpj }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async create(data: Omit<Customer, 'id'>): Promise<Customer> {
    const doc = await CustomerModel.create(data);
    return this.toEntity(doc.toObject());
  }

  async update(id: string, data: Partial<Omit<Customer, 'id'>>): Promise<Customer | null> {
    const doc = await CustomerModel.findByIdAndUpdate(id, data, { new: true }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await CustomerModel.findByIdAndDelete(id);
    return result !== null;
  }
}
