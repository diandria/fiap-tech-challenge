import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { ICustomerRepository } from '../ports/ICustomerRepository';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { NotFoundError } from '../../entities/errors/AppError';
import { assertTransition } from '../../entities/serviceOrderStateMachine';
import { findOSOrThrow, verifyCustomerCode } from '../utils/serviceOrderUtils';
import { IStatusChangeNotifier } from '../ports/IStatusChangeNotifier';
import { IDecideBudget, DecideBudgetInput } from '../ports/input/IDecideBudget';
import { assertOwnership } from '../utils/ownership';

export class ApproveBudgetUseCase implements IDecideBudget {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly notifyStatusChange: IStatusChangeNotifier,
  ) {}

  async execute(input: DecideBudgetInput): Promise<ServiceOrder> {
    const { osId, code } = input;
    const os = await findOSOrThrow(this.osRepo, osId);

    // Before the state machine and before any write. Refusing after a side
    // effect has already been applied would return 403 with the order changed.
    assertOwnership(os, input.requesterCustomerId);

    assertTransition(os.status, 'APPROVED');

    const customer = await this.customerRepo.findById(os.customerId);
    if (!customer) throw new NotFoundError('Customer');

    verifyCustomerCode(customer, code);

    const updated = await this.osRepo.update(osId, { status: 'APPROVED' });
    await this.notifyStatusChange.execute({ osId });
    return updated!;
  }
}
