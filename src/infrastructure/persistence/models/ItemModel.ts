import mongoose, { Schema, Document } from 'mongoose';

interface ItemDocument extends Document {
  name: string;
  price: number;
  stockQuantity: number;
  reservedQuantity: number;
}

const itemSchema = new Schema<ItemDocument>({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  stockQuantity: { type: Number, required: true, min: 0, default: 0 },
  reservedQuantity: { type: Number, required: true, min: 0, default: 0 },
});

export const ItemModel = mongoose.model<ItemDocument>('Item', itemSchema);
