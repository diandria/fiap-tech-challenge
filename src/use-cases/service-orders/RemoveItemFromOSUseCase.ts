import { IUnitOfWork } from '../ports/IUnitOfWork';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { NotFoundError, ValidationError } from '../../entities/errors/AppError';
import { findOSOrThrow } from '../utils/serviceOrderUtils';

export class RemoveItemFromOSUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(osId: string, itemId: string): Promise<ServiceOrder> {
    // Releasing the reservation and dropping the order line commit together.
    return this.unitOfWork.run(async ({ serviceOrders, items }) => {
      const os = await findOSOrThrow(serviceOrders, osId);
      if (os.status !== 'DIAGNOSIS') throw new ValidationError('Items can only be removed during DIAGNOSIS');

      const existing = os.items.find((i) => i.itemId === itemId);
      if (!existing) throw new NotFoundError('Item in order');

      const item = await items.findById(itemId);
      if (item) {
        await items.update(itemId, { reservedQuantity: item.reservedQuantity - existing.quantity });
      }

      const lines = os.items.filter((i) => i.itemId !== itemId);
      const updated = await serviceOrders.update(osId, { items: lines });
      return updated!;
    });
  }
}
