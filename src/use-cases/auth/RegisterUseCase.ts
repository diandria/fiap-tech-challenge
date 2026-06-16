import bcrypt from 'bcryptjs';
import { IUserRepository } from '../ports/IUserRepository';
import { UserRole } from '../../entities/User';
import { ConflictError } from '../../entities/errors/AppError';

const BCRYPT_SALT_ROUNDS = 12;

interface RegisterInput {
  email: string;
  password: string;
  role: UserRole;
}

interface RegisterOutput {
  id: string;
  email: string;
  role: UserRole;
}

export class RegisterUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute({ email, password, role }: RegisterInput): Promise<RegisterOutput> {
    const existing = await this.userRepo.findByEmail(email);
    if (existing) throw new ConflictError('Email already in use');

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const user = await this.userRepo.create({ email, passwordHash, role });
    return { id: user.id, email: user.email, role: user.role };
  }
}
