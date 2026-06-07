import { IItemRepository } from '../../../use-cases/ports/IItemRepository';
import { Item } from '../../../entities/Item';
import { ItemModel } from '../models/ItemModel';

export class MongoItemRepository implements IItemRepository {
  private toEntity(doc: any): Item {
    return {
      id: doc._id.toString(),
      name: doc.name,
      price: doc.price,
      stockQuantity: doc.stockQuantity,
      reservedQuantity: doc.reservedQuantity,
    };
  }

  async findAll(): Promise<Item[]> {
    const docs = await ItemModel.find().lean();
    return docs.map((d) => this.toEntity(d));
  }

  async findById(id: string): Promise<Item | null> {
    const doc = await ItemModel.findById(id).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async create(data: Omit<Item, 'id'>): Promise<Item> {
    const doc = await ItemModel.create(data);
    return this.toEntity(doc.toObject());
  }

  async update(id: string, data: Partial<Omit<Item, 'id'>>): Promise<Item | null> {
    const doc = await ItemModel.findByIdAndUpdate(id, data, { new: true }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await ItemModel.findByIdAndDelete(id);
    return result !== null;
  }
}
