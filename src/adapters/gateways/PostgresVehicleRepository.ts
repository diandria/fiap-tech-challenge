import { PrismaClient } from '@prisma/client';
import { IVehicleRepository } from '../../use-cases/ports/IVehicleRepository';
import { Vehicle } from '../../entities/Vehicle';

interface VehicleRow {
  id: string;
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
}

export class PostgresVehicleRepository implements IVehicleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toEntity(row: VehicleRow): Vehicle {
    return {
      id: row.id,
      customerId: row.customerId,
      plate: row.plate,
      brand: row.brand,
      model: row.model,
      year: row.year,
    };
  }

  async findAll(customerId?: string): Promise<Vehicle[]> {
    const rows = await this.prisma.vehicle.findMany({
      where: customerId ? { customerId } : {},
    });
    return rows.map((r) => this.toEntity(r as VehicleRow));
  }

  async findById(id: string): Promise<Vehicle | null> {
    const row = await this.prisma.vehicle.findUnique({ where: { id } });
    return row ? this.toEntity(row as VehicleRow) : null;
  }

  async findByPlate(plate: string): Promise<Vehicle | null> {
    const row = await this.prisma.vehicle.findUnique({ where: { plate } });
    return row ? this.toEntity(row as VehicleRow) : null;
  }

  async create(data: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    const row = await this.prisma.vehicle.create({ data });
    return this.toEntity(row as VehicleRow);
  }

  async update(id: string, data: Partial<Omit<Vehicle, 'id'>>): Promise<Vehicle | null> {
    const existing = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!existing) return null;

    const row = await this.prisma.vehicle.update({ where: { id }, data });
    return this.toEntity(row as VehicleRow);
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.prisma.vehicle.findUnique({ where: { id } });
    if (!existing) return false;

    await this.prisma.vehicle.delete({ where: { id } });
    return true;
  }
}
