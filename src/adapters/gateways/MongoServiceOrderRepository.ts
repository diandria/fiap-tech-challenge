import { IServiceOrderRepository, ListServiceOrdersFilter, AvgExecutionResult } from '../../use-cases/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { ServiceOrderModel } from '../../frameworks/database/models/ServiceOrderModel';

export class MongoServiceOrderRepository implements IServiceOrderRepository {
  private toEntity(doc: any): ServiceOrder {
    return {
      id: doc._id.toString(),
      customerId: doc.customerId,
      vehicleId: doc.vehicleId,
      status: doc.status,
      budgetTotal: doc.budgetTotal,
      services: doc.services ?? [],
      items: doc.items ?? [],
      createdAt: doc.createdAt,
      startedAt: doc.startedAt,
      finishedAt: doc.finishedAt,
      deliveredAt: doc.deliveredAt,
    };
  }

  async findAll(filter?: ListServiceOrdersFilter): Promise<ServiceOrder[]> {
    const query: Record<string, unknown> = {};
    if (filter?.status) query.status = filter.status;
    if (filter?.customerId) query.customerId = filter.customerId;
    if (filter?.from || filter?.to) {
      query.createdAt = {
        ...(filter.from && { $gte: filter.from }),
        ...(filter.to && { $lte: filter.to }),
      };
    }
    const docs = await ServiceOrderModel.find(query).lean();
    return docs.map((d) => this.toEntity(d));
  }

  async findById(id: string): Promise<ServiceOrder | null> {
    const doc = await ServiceOrderModel.findById(id).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async create(data: Omit<ServiceOrder, 'id' | 'createdAt'>): Promise<ServiceOrder> {
    const doc = await ServiceOrderModel.create(data);
    return this.toEntity(doc.toObject());
  }

  async update(id: string, data: Partial<Omit<ServiceOrder, 'id'>>): Promise<ServiceOrder | null> {
    const doc = await ServiceOrderModel.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    return doc ? this.toEntity(doc) : null;
  }

  async getAvgExecutionByService(): Promise<AvgExecutionResult[]> {
    const results = await ServiceOrderModel.aggregate([
      { $unwind: '$services' },
      {
        $match: {
          'services.startedAt': { $exists: true, $ne: null },
          'services.finishedAt': { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$services.serviceId',
          avgMinutes: {
            $avg: {
              $divide: [
                { $subtract: ['$services.finishedAt', '$services.startedAt'] },
                60000,
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, serviceId: '$_id', avgMinutes: 1, count: 1 } },
    ]);
    return results.map((r: any) => ({
      serviceId: r.serviceId as string,
      avgMinutes: r.avgMinutes as number,
      count: r.count as number,
    }));
  }
}
