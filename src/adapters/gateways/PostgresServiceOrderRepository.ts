import { PrismaClient, Prisma } from '@prisma/client';
import {
  IServiceOrderRepository,
  ListServiceOrdersFilter,
  AvgExecutionResult,
} from '../../use-cases/ports/IServiceOrderRepository';
import { ServiceOrder, OSStatus, OSService, OSItem } from '../../entities/ServiceOrder';

const INCLUDE_RELATIONS = {
  services: { select: { serviceId: true, startedAt: true, finishedAt: true } },
  items: { select: { itemId: true, quantity: true } },
} as const;

interface ServiceLineRow {
  serviceId: string;
  startedAt: Date | null;
  finishedAt: Date | null;
}

interface ItemLineRow {
  itemId: string;
  quantity: number;
}

interface ServiceOrderRow {
  id: string;
  customerId: string;
  vehicleId: string;
  status: OSStatus;
  budgetTotal: Prisma.Decimal | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  deliveredAt: Date | null;
  services: ServiceLineRow[];
  items: ItemLineRow[];
}

export class PostgresServiceOrderRepository implements IServiceOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private toService(row: ServiceLineRow): OSService {
    return {
      serviceId: row.serviceId,
      ...(row.startedAt ? { startedAt: row.startedAt } : {}),
      ...(row.finishedAt ? { finishedAt: row.finishedAt } : {}),
    };
  }

  private toEntity(row: ServiceOrderRow): ServiceOrder {
    return {
      id: row.id,
      customerId: row.customerId,
      vehicleId: row.vehicleId,
      status: row.status,
      ...(row.budgetTotal !== null ? { budgetTotal: Number(row.budgetTotal) } : {}),
      services: row.services.map((s) => this.toService(s)),
      items: row.items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
      createdAt: row.createdAt,
      ...(row.startedAt ? { startedAt: row.startedAt } : {}),
      ...(row.finishedAt ? { finishedAt: row.finishedAt } : {}),
      ...(row.deliveredAt ? { deliveredAt: row.deliveredAt } : {}),
    };
  }

  private buildWhere(filter?: ListServiceOrdersFilter): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (filter?.status) where.status = filter.status;
    // excludeStatuses e status nunca chegam juntos: o use case escolhe um dos dois.
    if (filter?.excludeStatuses?.length) where.status = { notIn: filter.excludeStatuses };
    if (filter?.customerId) where.customerId = filter.customerId;

    if (filter?.from || filter?.to) {
      where.createdAt = {
        ...(filter.from ? { gte: filter.from } : {}),
        ...(filter.to ? { lte: filter.to } : {}),
      };
    }

    return where;
  }

  async findAll(filter?: ListServiceOrdersFilter): Promise<ServiceOrder[]> {
    // A ordenacao por prioridade de status e regra de negocio e permanece no use case.
    const rows = await this.prisma.serviceOrder.findMany({
      where: this.buildWhere(filter),
      include: INCLUDE_RELATIONS,
    });
    return rows.map((r) => this.toEntity(r as unknown as ServiceOrderRow));
  }

  async findById(id: string): Promise<ServiceOrder | null> {
    const row = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: INCLUDE_RELATIONS,
    });
    return row ? this.toEntity(row as unknown as ServiceOrderRow) : null;
  }

  async create(data: Omit<ServiceOrder, 'id' | 'createdAt'>): Promise<ServiceOrder> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.serviceOrder.create({
        data: {
          customerId: data.customerId,
          vehicleId: data.vehicleId,
          status: data.status,
          ...(data.budgetTotal !== undefined ? { budgetTotal: data.budgetTotal } : {}),
          services: { create: (data.services ?? []).map((s) => ({ serviceId: s.serviceId })) },
          items: {
            create: (data.items ?? []).map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
          },
        },
        include: INCLUDE_RELATIONS,
      });
      return this.toEntity(row as unknown as ServiceOrderRow);
    });
  }

  async update(
    id: string,
    data: Partial<Omit<ServiceOrder, 'id'>>,
  ): Promise<ServiceOrder | null> {
    const existing = await this.prisma.serviceOrder.findUnique({ where: { id } });
    if (!existing) return null;

    return this.prisma.$transaction(async (tx) => {
      // Substituir a lista inteira reproduz a escrita do array no modelo de documentos.
      if (data.services) {
        await tx.serviceOrderService.deleteMany({ where: { serviceOrderId: id } });
        await tx.serviceOrderService.createMany({
          data: data.services.map((s) => ({
            serviceOrderId: id,
            serviceId: s.serviceId,
            startedAt: s.startedAt ?? null,
            finishedAt: s.finishedAt ?? null,
          })),
        });
      }

      if (data.items) {
        await tx.serviceOrderItem.deleteMany({ where: { serviceOrderId: id } });
        await tx.serviceOrderItem.createMany({
          data: data.items.map((i) => ({
            serviceOrderId: id,
            itemId: i.itemId,
            quantity: i.quantity,
          })),
        });
      }

      const scalar: Record<string, unknown> = {};
      if (data.status !== undefined) scalar.status = data.status;
      if (data.budgetTotal !== undefined) scalar.budgetTotal = data.budgetTotal;
      if (data.startedAt !== undefined) scalar.startedAt = data.startedAt;
      if (data.finishedAt !== undefined) scalar.finishedAt = data.finishedAt;
      if (data.deliveredAt !== undefined) scalar.deliveredAt = data.deliveredAt;

      const row = await tx.serviceOrder.update({
        where: { id },
        data: scalar,
        include: INCLUDE_RELATIONS,
      });
      return this.toEntity(row as unknown as ServiceOrderRow);
    });
  }

  async getAvgExecutionByService(): Promise<AvgExecutionResult[]> {
    const rows = await this.prisma.$queryRaw<
      { serviceId: string; avgMinutes: number; count: bigint }[]
    >`
      SELECT service_id AS "serviceId",
             AVG(EXTRACT(EPOCH FROM (finished_at - started_at)) / 60)::float8 AS "avgMinutes",
             COUNT(*) AS count
      FROM service_order_services
      WHERE started_at IS NOT NULL AND finished_at IS NOT NULL
      GROUP BY service_id
    `;

    return rows.map((r) => ({
      serviceId: r.serviceId,
      avgMinutes: Number(r.avgMinutes),
      count: Number(r.count),
    }));
  }
}
