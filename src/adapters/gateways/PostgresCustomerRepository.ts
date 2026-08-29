import { PrismaClient } from '@prisma/client';
import { ICustomerRepository } from '../../use-cases/ports/ICustomerRepository';
import { Customer, TaxType } from '../../entities/Customer';

interface CustomerRow {
  id: string;
  name: string;
  taxId: string;
  taxType: TaxType;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const active = { deletedAt: null };

export class PostgresCustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toEntity(row: CustomerRow): Customer {
    return {
      id: row.id,
      name: row.name,
      taxId: row.taxId,
      taxType: row.taxType,
      email: row.email,
      phone: row.phone,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ...(row.deletedAt ? { deletedAt: row.deletedAt } : {}),
    };
  }

  async findAll(): Promise<Customer[]> {
    const rows = await this.prisma.customer.findMany({ where: active });
    return rows.map((r) => this.toEntity(r as CustomerRow));
  }

  async findById(id: string): Promise<Customer | null> {
    const row = await this.prisma.customer.findFirst({ where: { id, ...active } });
    return row ? this.toEntity(row as CustomerRow) : null;
  }

  async findByTaxId(taxId: string): Promise<Customer | null> {
    const row = await this.prisma.customer.findFirst({ where: { taxId, ...active } });
    return row ? this.toEntity(row as CustomerRow) : null;
  }

  async create(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Promise<Customer> {
    const row = await this.prisma.customer.create({ data });
    return this.toEntity(row as CustomerRow);
  }

  async update(
    id: string,
    data: Partial<Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<Customer | null> {
    const existing = await this.prisma.customer.findFirst({ where: { id, ...active } });
    if (!existing) return null;

    const row = await this.prisma.customer.update({ where: { id }, data });
    return this.toEntity(row as CustomerRow);
  }

  async softDelete(id: string): Promise<boolean> {
    const existing = await this.prisma.customer.findFirst({ where: { id, ...active } });
    if (!existing) return false;

    await this.prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
    return true;
  }
}
