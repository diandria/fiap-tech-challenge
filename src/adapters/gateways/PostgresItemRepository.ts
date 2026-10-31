import { isUuid } from './uuid';
import { Prisma } from '@prisma/client';
import { PrismaExecutor } from './prismaExecutor';
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
  constructor(private readonly prisma: PrismaExecutor) {}

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
    if (!isUuid(id)) return null;
    const row = await this.prisma.item.findUnique({ where: { id } });
    return row ? this.toEntity(row as ItemRow) : null;
  }

  async create(data: Omit<Item, 'id'>): Promise<Item> {
    const row = await this.prisma.item.create({ data });
    return this.toEntity(row as ItemRow);
  }

  async update(id: string, data: Partial<Omit<Item, 'id'>>): Promise<Item | null> {
    if (!isUuid(id)) return null;
    const existing = await this.prisma.item.findUnique({ where: { id } });
    if (!existing) return null;

    const row = await this.prisma.item.update({ where: { id }, data });
    return this.toEntity(row as ItemRow);
  }

  /**
   * A conditional update rather than read, check and write: concurrent
   * reservations of the last units cannot all see the same balance, because
   * the database checks it while holding the row lock.
   */
  async reserve(id: string, quantity: number): Promise<boolean> {
    if (!isUuid(id)) return false;
    const reservedRows = await this.prisma.$executeRaw`
      UPDATE items
         SET reserved_quantity = reserved_quantity + ${quantity}
       WHERE id = ${id}::uuid
         AND stock_quantity - reserved_quantity >= ${quantity}
    `;
    return reservedRows === 1;
  }

  async release(id: string, quantity: number): Promise<boolean> {
    if (!isUuid(id)) return false;
    // Conditional, like the reservation: a reservation never goes negative,
    // even if the same release ran twice.
    const releasedRows = await this.prisma.$executeRaw`
      UPDATE items
         SET reserved_quantity = reserved_quantity - ${quantity}
       WHERE id = ${id}::uuid
         AND reserved_quantity >= ${quantity}
    `;
    return releasedRows === 1;
  }

  async consume(id: string, quantity: number): Promise<boolean> {
    if (!isUuid(id)) return false;
    const consumedRows = await this.prisma.$executeRaw`
      UPDATE items
         SET stock_quantity = stock_quantity - ${quantity},
             reserved_quantity = reserved_quantity - ${quantity}
       WHERE id = ${id}::uuid
         AND reserved_quantity >= ${quantity}
         AND stock_quantity >= ${quantity}
    `;
    return consumedRows === 1;
  }

  async delete(id: string): Promise<boolean> {
    if (!isUuid(id)) return false;
    const existing = await this.prisma.item.findUnique({ where: { id } });
    if (!existing) return false;

    await this.prisma.item.delete({ where: { id } });
    return true;
  }
}
