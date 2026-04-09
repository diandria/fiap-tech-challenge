import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { NotFoundError, ValidationError } from '../../../domain/errors/AppError';
import { assertTransition } from '../../../domain/serviceOrderStateMachine';

export class ApproveBudgetUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly customerRepo: ICustomerRepository,
  ) {}

  async execute(osId: string, code: string): Promise<ServiceOrder> {
    const os = await this.osRepo.findById(osId);
    if (!os) throw new NotFoundError('Service order');
    assertTransition(os.status, 'EXECUTION');

    const customer = await this.customerRepo.findById(os.customerId);
    if (!customer) throw new NotFoundError('Customer');

    const expectedCode = customer.taxId.slice(0, 4);
    if (code !== expectedCode) throw new ValidationError('Invalid confirmation code');

    const updated = await this.osRepo.update(osId, { status: 'EXECUTION' });
    return updated!;
  }
}
