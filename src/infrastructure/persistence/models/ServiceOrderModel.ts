import mongoose, { Schema, Document } from 'mongoose';
import { OSStatus } from '../../../domain/entities/ServiceOrder';

interface ServiceOrderDocument extends Document {
  customerId: string;
  vehicleId: string;
  status: OSStatus;
  budgetTotal?: number;
  services: { serviceId: string; startedAt?: Date; finishedAt?: Date }[];
  items: { itemId: string; quantity: number }[];
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  deliveredAt?: Date;
}

const osServiceSchema = new Schema(
  { serviceId: { type: String, required: true }, startedAt: Date, finishedAt: Date },
  { _id: false },
);

const osItemSchema = new Schema(
  { itemId: { type: String, required: true }, quantity: { type: Number, required: true, min: 1 } },
  { _id: false },
);

const serviceOrderSchema = new Schema<ServiceOrderDocument>(
  {
    customerId: { type: String, required: true },
    vehicleId: { type: String, required: true },
    status: {
      type: String,
      enum: ['RECEIVED', 'DIAGNOSIS', 'WAITING_APPROVAL', 'APPROVED', 'EXECUTION', 'FINISHED', 'DELIVERED', 'REJECTED'],
      required: true,
      default: 'RECEIVED',
    },
    budgetTotal: { type: Number },
    services: [osServiceSchema],
    items: [osItemSchema],
    startedAt: Date,
    finishedAt: Date,
    deliveredAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ServiceOrderModel = mongoose.model<ServiceOrderDocument>('ServiceOrder', serviceOrderSchema);
