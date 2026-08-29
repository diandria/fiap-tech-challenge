import { PrismaClient, Prisma } from '@prisma/client';
import { IItemRepository } from '../../use-cases/ports/IItemRepository';
import { Item } from '../../entities/Item';

interface ItemRow {
  id: string;
  name: string;
  price: Prisma.Decimal;
  stockQuantity: number;
  reservedQuantity: number;
}

export class PostgresItemRepository implements IItemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toEntity(row: ItemRow): Item {
    return {
      id: row.id,
      name: row.name,
      price: Number(row.price),
      stockQuantity: row.stockQuantity,
      reservedQuantity: row.reservedQuantity,
    };
  }

  async findAll(): Promise<Item[]> {
    const rows = await this.prisma.item.findMany();
    return rows.map((r) => this.toEntity(r as ItemRow));
  }

  async findById(id: string): Promise<Item | null> {
    const row = await this.prisma.item.findUnique({ where: { id } });
    return row ? this.toEntity(row as ItemRow) : null;
  }

  async create(data: Omit<Item, 'id'>): Promise<Item> {
    const row = await this.prisma.item.create({ data });
    return this.toEntity(row as ItemRow);
  }

  async update(id: string, data: Partial<Omit<Item, 'id'>>): Promise<Item | null> {
    const existing = await this.prisma.item.findUnique({ where: { id } });
    if (!existing) return null;

    const row = await this.prisma.item.update({ where: { id }, data });
    return this.toEntity(row as ItemRow);
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.prisma.item.findUnique({ where: { id } });
    if (!existing) return false;

    await this.prisma.item.delete({ where: { id } });
    return true;
  }
}
