import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { IServiceRepository } from '../ports/IServiceRepository';
import { IItemRepository } from '../ports/IItemRepository';
import { ServiceOrder, OSService, OSItem } from '../../entities/ServiceOrder';
import { getAvailableQuantity } from '../../entities/Item';
import { NotFoundError, ValidationError } from '../../entities/errors/AppError';
import { ICreateServiceOrder, CreateServiceOrderInput } from '../ports/input/ICreateServiceOrder';

export class CreateServiceOrderUseCase implements ICreateServiceOrder {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly serviceRepo: IServiceRepository,
    private readonly itemRepo: IItemRepository,
  ) {}

  async execute(input: CreateServiceOrderInput): Promise<ServiceOrder> {
    const resolvedServices: OSService[] = [];
    for (const serviceId of input.services ?? []) {
      const service = await this.serviceRepo.findById(serviceId);
      if (!service) throw new NotFoundError(`Service ${serviceId}`);
      resolvedServices.push({ serviceId });
    }

    const resolvedItems: OSItem[] = [];
    try {
      for (const { itemId, quantity } of input.items ?? []) {
        const item = await this.itemRepo.findById(itemId);
        if (!item) throw new NotFoundError(`Item ${itemId}`);
        if (getAvailableQuantity(item) < quantity) {
          throw new ValidationError(`Insufficient stock for item ${itemId}`);
        }
        await this.itemRepo.update(itemId, { reservedQuantity: item.reservedQuantity + quantity });
        resolvedItems.push({ itemId, quantity });
      }
    } catch (err) {
      for (const { itemId, quantity } of resolvedItems) {
        const item = await this.itemRepo.findById(itemId);
        if (item) {
          await this.itemRepo.update(itemId, {
            reservedQuantity: Math.max(0, item.reservedQuantity - quantity),
          });
        }
      }
      throw err;
    }

    return this.osRepo.create({
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      status: 'RECEIVED',
      services: resolvedServices,
      items: resolvedItems,
    });
  }
}
