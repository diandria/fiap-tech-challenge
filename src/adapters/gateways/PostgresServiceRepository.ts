import { isUuid } from './uuid';
import { PrismaClient, Prisma } from '@prisma/client';
import { IServiceRepository } from '../../use-cases/ports/IServiceRepository';
import { Service } from '../../entities/Service';

interface ServiceRow {
  id: string;
  name: string;
  price: Prisma.Decimal;
  estimatedMinutes: number;
}

export class PostgresServiceRepository implements IServiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toEntity(row: ServiceRow): Service {
    return {
      id: row.id,
      name: row.name,
      // Decimal arrives from the database as an object; the entity works with number.
      price: Number(row.price),
      estimatedMinutes: row.estimatedMinutes,
    };
  }

  async findAll(): Promise<Service[]> {
    const rows = await this.prisma.service.findMany();
    return rows.map((r) => this.toEntity(r as ServiceRow));
  }

  async findById(id: string): Promise<Service | null> {
    if (!isUuid(id)) return null;
    const row = await this.prisma.service.findUnique({ where: { id } });
    return row ? this.toEntity(row as ServiceRow) : null;
  }

  async create(data: Omit<Service, 'id'>): Promise<Service> {
    const row = await this.prisma.service.create({ data });
    return this.toEntity(row as ServiceRow);
  }

  async update(id: string, data: Partial<Omit<Service, 'id'>>): Promise<Service | null> {
    if (!isUuid(id)) return null;
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) return null;

    const row = await this.prisma.service.update({ where: { id }, data });
    return this.toEntity(row as ServiceRow);
  }

  async delete(id: string): Promise<boolean> {
    if (!isUuid(id)) return false;
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) return false;

    await this.prisma.service.delete({ where: { id } });
    return true;
  }
}
