import { IUserRepository, CreateUserData } from '../../../domain/ports/IUserRepository';
import { User } from '../../../domain/entities/User';
import { UserModel } from '../models/UserModel';

export class MongoUserRepository implements IUserRepository {
  private toEntity(doc: any): User {
    return {
      id: doc._id.toString(),
      email: doc.email,
      passwordHash: doc.passwordHash,
      role: doc.role,
    };
  }

  async findById(id: string): Promise<User | null> {
    const doc = await UserModel.findById(id).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const doc = await UserModel.findOne({ email: email.toLowerCase() }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async create(data: CreateUserData): Promise<User> {
    const doc = await UserModel.create(data);
    return this.toEntity(doc.toObject());
  }
}
