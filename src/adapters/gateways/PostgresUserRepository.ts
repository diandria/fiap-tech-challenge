import { isUuid } from './uuid';
import { PrismaClient } from '@prisma/client';
import { IUserRepository, CreateUserData } from '../../use-cases/ports/IUserRepository';
import { User, UserRole } from '../../entities/User';

interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toEntity(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role,
    };
  }

  async findById(id: string): Promise<User | null> {
    if (!isUuid(id)) return null;
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toEntity(row as UserRow) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? this.toEntity(row as UserRow) : null;
  }

  async create(data: CreateUserData): Promise<User> {
    const row = await this.prisma.user.create({ data });
    return this.toEntity(row as UserRow);
  }
}
