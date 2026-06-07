import mongoose, { Schema, Document } from 'mongoose';

interface VehicleDocument extends Document {
  customerId: string;
  plate: string;
  brand: string;
  vehicleModel: string;
  year: number;
}

const vehicleSchema = new Schema<VehicleDocument>({
  customerId: { type: String, required: true },
  plate: { type: String, required: true, unique: true, uppercase: true },
  brand: { type: String, required: true },
  vehicleModel: { type: String, required: true },
  year: { type: Number, required: true },
});

export const VehicleModel = mongoose.model<VehicleDocument>('Vehicle', vehicleSchema);
