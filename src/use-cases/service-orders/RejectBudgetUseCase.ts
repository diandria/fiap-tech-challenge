import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { ICustomerRepository } from '../ports/ICustomerRepository';
import { IItemRepository } from '../ports/IItemRepository';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { NotFoundError } from '../../entities/errors/AppError';
import { assertTransition } from '../../entities/serviceOrderStateMachine';
import { findOSOrThrow, verifyCustomerCode } from '../utils/serviceOrderUtils';
import { IStatusChangeNotifier } from '../ports/IStatusChangeNotifier';
import { IDecideBudget } from '../ports/input/IDecideBudget';

export class RejectBudgetUseCase implements IDecideBudget {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly itemRepo: IItemRepository,
    private readonly notifyStatusChange: IStatusChangeNotifier,
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
    await this.notifyStatusChange.execute({ osId });
    return updated!;
  }
}
