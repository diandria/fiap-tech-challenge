import { ICustomerRepository } from '../../../use-cases/ports/ICustomerRepository';
import { Customer } from '../../../entities/Customer';
import { CustomerModel } from '../models/CustomerModel';

const notDeleted = { deletedAt: null };

export class MongoCustomerRepository implements ICustomerRepository {
  private toEntity(doc: any): Customer {
    return {
      id: doc._id.toString(),
      name: doc.name,
      taxId: doc.taxId,
      taxType: doc.taxType,
      email: doc.email,
      phone: doc.phone,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      ...(doc.deletedAt ? { deletedAt: doc.deletedAt } : {}),
    };
  }

  async findAll(): Promise<Customer[]> {
    const docs = await CustomerModel.find(notDeleted).lean();
    return docs.map((d) => this.toEntity(d));
  }

  async findById(id: string): Promise<Customer | null> {
    const doc = await CustomerModel.findOne({ _id: id, ...notDeleted }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByTaxId(taxId: string): Promise<Customer | null> {
    const doc = await CustomerModel.findOne({ taxId, ...notDeleted }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async create(data: Omit<Customer, 'id'>): Promise<Customer> {
    const doc = await CustomerModel.create(data);
    return this.toEntity(doc.toObject());
  }

  async update(id: string, data: Partial<Omit<Customer, 'id'>>): Promise<Customer | null> {
    const doc = await CustomerModel.findOneAndUpdate(
      { _id: id, ...notDeleted },
      data,
      { new: true },
    ).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await CustomerModel.findOneAndUpdate(
      { _id: id, ...notDeleted },
      { deletedAt: new Date() },
    );
    return result !== null;
  }
}
