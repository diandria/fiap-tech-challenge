import { IUnitOfWork } from '../ports/IUnitOfWork';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { NotFoundError, ValidationError } from '../../entities/errors/AppError';
import { findOSOrThrow } from '../utils/serviceOrderUtils';

export class AddItemToOSUseCase {
  constructor(private readonly unitOfWork: IUnitOfWork) {}

  async execute(osId: string, itemId: string, quantity: number): Promise<ServiceOrder> {
    // The reservation and the order line commit together, or neither does.
    return this.unitOfWork.run(async ({ serviceOrders, items }) => {
      const os = await findOSOrThrow(serviceOrders, osId);
      if (os.status !== 'DIAGNOSIS') throw new ValidationError('Items can only be added during DIAGNOSIS');

      const item = await items.findById(itemId);
      if (!item) throw new NotFoundError('Item');

      if (!(await items.reserve(itemId, quantity))) {
        throw new ValidationError('Insufficient stock available');
      }

      const existing = os.items.find((i) => i.itemId === itemId);
      const lines = existing
        ? os.items.map((i) => (i.itemId === itemId ? { itemId, quantity: i.quantity + quantity } : i))
        : [...os.items, { itemId, quantity }];

      const updated = await serviceOrders.update(osId, { items: lines });
      return updated!;
    });
  }
}
