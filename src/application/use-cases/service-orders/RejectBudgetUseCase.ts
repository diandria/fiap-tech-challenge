import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { NotFoundError } from '../../../domain/errors/AppError';
import { assertTransition } from '../../../domain/serviceOrderStateMachine';
import { findOSOrThrow, verifyCustomerCode } from '../../utils/serviceOrderUtils';

export class RejectBudgetUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly itemRepo: IItemRepository,
  ) {}

  async execute(osId: string, code: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    assertTransition(os.status, 'REJECTED');

    const customer = await this.customerRepo.findById(os.customerId);
    if (!customer) throw new NotFoundError('Customer');

    verifyCustomerCode(customer, code);

    for (const i of os.items) {
      const item = await this.itemRepo.findById(i.itemId);
      if (!item) throw new NotFoundError('Item');
      await this.itemRepo.update(i.itemId, {
        reservedQuantity: item.reservedQuantity - i.quantity,
      });
    }

    const updated = await this.osRepo.update(osId, { status: 'REJECTED' });
    return updated!;
  }
}
