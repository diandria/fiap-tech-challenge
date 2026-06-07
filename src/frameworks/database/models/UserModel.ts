import mongoose, { Schema, Document } from 'mongoose';

interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  role: 'attendant' | 'mechanic' | 'admin';
}

const userSchema = new Schema<UserDocument>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['attendant', 'mechanic', 'admin'], required: true },
});

export const UserModel = mongoose.model<UserDocument>('User', userSchema);
