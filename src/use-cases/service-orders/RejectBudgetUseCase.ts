import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { ICustomerRepository } from '../ports/ICustomerRepository';
import { IItemRepository } from '../ports/IItemRepository';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { NotFoundError } from '../../entities/errors/AppError';
import { assertTransition } from '../../entities/serviceOrderStateMachine';
import { findOSOrThrow, verifyCustomerCode } from '../utils/serviceOrderUtils';
import { IStatusChangeNotifier } from '../ports/IStatusChangeNotifier';
import { IDecideBudget, DecideBudgetInput } from '../ports/input/IDecideBudget';
import { assertOwnership } from '../utils/ownership';

export class RejectBudgetUseCase implements IDecideBudget {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly itemRepo: IItemRepository,
    private readonly notifyStatusChange: IStatusChangeNotifier,
  ) {}

  async execute(input: DecideBudgetInput): Promise<ServiceOrder> {
    const { osId, code } = input;
    const os = await findOSOrThrow(this.osRepo, osId);

    // Before the state machine and before any write. Refusing after a side
    // effect has already been applied would return 403 with the order changed.
    assertOwnership(os, input.requesterCustomerId);

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
