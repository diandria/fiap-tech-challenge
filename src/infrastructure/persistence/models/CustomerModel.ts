import mongoose, { Schema, Document } from 'mongoose';

interface CustomerDocument extends Document {
  name: string;
  cpfCnpj: string;
  email: string;
  phone: string;
}

const customerSchema = new Schema<CustomerDocument>({
  name: { type: String, required: true, trim: true },
  cpfCnpj: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, required: true },
});

export const CustomerModel = mongoose.model<CustomerDocument>('Customer', customerSchema);
