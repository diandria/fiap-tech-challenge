import { IServiceRepository } from '../ports/IServiceRepository';
import { IUnitOfWork } from '../ports/IUnitOfWork';
import { ServiceOrder, OSService, OSItem } from '../../entities/ServiceOrder';
import { NotFoundError, ValidationError } from '../../entities/errors/AppError';
import { ICreateServiceOrder, CreateServiceOrderInput } from '../ports/input/ICreateServiceOrder';

export class CreateServiceOrderUseCase implements ICreateServiceOrder {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly serviceRepo: IServiceRepository,
  ) {}

  async execute(input: CreateServiceOrderInput): Promise<ServiceOrder> {
    const services = await this.resolveServices(input.services ?? []);

    // The first step of the saga, in one local transaction: the order, its
    // stock reservations and the request for a diagnosis commit together. If
    // the insert fails, the reservations are rolled back and nothing is sent.
    return this.unitOfWork.run(async ({ serviceOrders, items, outbox }) => {
      const reservedItems: OSItem[] = [];

      for (const { itemId, quantity } of input.items ?? []) {
        const item = await items.findById(itemId);
        if (!item) throw new NotFoundError(`Item ${itemId}`);
        if (!(await items.reserve(itemId, quantity))) {
          throw new ValidationError(`Insufficient stock for item ${itemId}`);
        }
        reservedItems.push({ itemId, quantity });
      }

      const order = await serviceOrders.create({
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        status: 'RECEIVED',
        services,
        items: reservedItems,
      });

      await outbox.add({ destination: 'execution-commands', type: 'EnqueueDiagnosis', serviceOrderId: order.id, payload: {} });
      return order;
    });
  }

  private async resolveServices(serviceIds: string[]): Promise<OSService[]> {
    const resolved: OSService[] = [];
    for (const serviceId of serviceIds) {
      const service = await this.serviceRepo.findById(serviceId);
      if (!service) throw new NotFoundError(`Service ${serviceId}`);
      resolved.push({ serviceId });
    }
    return resolved;
  }
}
