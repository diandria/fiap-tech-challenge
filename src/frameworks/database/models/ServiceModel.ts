import mongoose, { Schema, Document } from 'mongoose';

interface ServiceDocument extends Document {
  name: string;
  price: number;
  estimatedMinutes: number;
}

const serviceSchema = new Schema<ServiceDocument>({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  estimatedMinutes: { type: Number, required: true, min: 0 },
});

export const ServiceModel = mongoose.model<ServiceDocument>('Service', serviceSchema);
