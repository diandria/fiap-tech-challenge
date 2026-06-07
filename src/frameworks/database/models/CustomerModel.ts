import mongoose, { Schema, Document } from 'mongoose';
import { TaxType } from '../../../entities/Customer';

interface CustomerDocument extends Document {
  name: string;
  taxId: string;
  taxType: TaxType;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const customerSchema = new Schema<CustomerDocument>({
  name: { type: String, required: true, trim: true },
  taxId: { type: String, required: true, unique: true },
  taxType: { type: String, enum: ['CPF', 'CNPJ'], required: true },
  deletedAt: { type: Date, default: null },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, required: true },
}, { timestamps: true });

export const CustomerModel = mongoose.model<CustomerDocument>('Customer', customerSchema);
