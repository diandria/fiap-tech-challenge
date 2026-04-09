import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { Item } from '../../../domain/entities/Item';
import { ItemModel } from '../models/ItemModel';
import { NotFoundError } from '../../../domain/errors/AppError';

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

  async reserve(id: string, quantity: number): Promise<Item> {
    const doc = await ItemModel.findByIdAndUpdate(
      id,
      { $inc: { reservedQuantity: quantity } },
      { new: true },
    ).lean();
    if (!doc) throw new NotFoundError('Item');
    return this.toEntity(doc);
  }

  async release(id: string, quantity: number): Promise<Item> {
    const doc = await ItemModel.findByIdAndUpdate(
      id,
      { $inc: { reservedQuantity: -quantity } },
      { new: true },
    ).lean();
    if (!doc) throw new NotFoundError('Item');
    return this.toEntity(doc);
  }

  async consume(id: string, quantity: number): Promise<Item> {
    const doc = await ItemModel.findByIdAndUpdate(
      id,
      { $inc: { stockQuantity: -quantity, reservedQuantity: -quantity } },
      { new: true },
    ).lean();
    if (!doc) throw new NotFoundError('Item');
    return this.toEntity(doc);
  }
}
