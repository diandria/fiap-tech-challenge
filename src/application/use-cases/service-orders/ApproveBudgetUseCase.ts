import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { NotFoundError } from '../../../domain/errors/AppError';
import { assertTransition } from '../../../domain/serviceOrderStateMachine';
import { findOSOrThrow, verifyCustomerCode } from '../../utils/serviceOrderUtils';

export class ApproveBudgetUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly customerRepo: ICustomerRepository,
  ) {}

  async execute(osId: string, code: string): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.osRepo, osId);
    assertTransition(os.status, 'APPROVED');

    const customer = await this.customerRepo.findById(os.customerId);
    if (!customer) throw new NotFoundError('Customer');

    verifyCustomerCode(customer, code);

    const updated = await this.osRepo.update(osId, { status: 'APPROVED' });
    return updated!;
  }
}
