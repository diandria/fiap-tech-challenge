import { User, UserRole } from '../../entities/User';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  role: UserRole;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
}
