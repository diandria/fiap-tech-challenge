import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { IItemRepository } from '../../../domain/ports/IItemRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { NotFoundError, ValidationError } from '../../../domain/errors/AppError';
import { assertTransition } from '../../../domain/serviceOrderStateMachine';

export class ApproveBudgetUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly itemRepo: IItemRepository,
  ) {}

  async execute(osId: string, code: string): Promise<ServiceOrder> {
    const os = await this.osRepo.findById(osId);
    if (!os) throw new NotFoundError('Service order');
    assertTransition(os.status, 'EXECUTION');

    const customer = await this.customerRepo.findById(os.customerId);
    if (!customer) throw new NotFoundError('Customer');

    const expectedCode = customer.taxId.slice(0, 4);
    if (code !== expectedCode) throw new ValidationError('Invalid confirmation code');

    for (const i of os.items) {
      const item = await this.itemRepo.findById(i.itemId);
      if (!item) throw new NotFoundError('Item');
      await this.itemRepo.update(i.itemId, {
        stockQuantity: item.stockQuantity - i.quantity,
        reservedQuantity: item.reservedQuantity - i.quantity,
      });
    }

    const updated = await this.osRepo.update(osId, { status: 'EXECUTION', startedAt: new Date() });
    return updated!;
  }
}
