import { IServiceRepository } from '../ports/IServiceRepository';
import { IItemRepository } from '../ports/IItemRepository';
import { IBudgetCalculator } from '../ports/IBudgetCalculator';
import { ServiceOrder } from '../../entities/ServiceOrder';

export class CalculateBudgetUseCase implements IBudgetCalculator {
  constructor(
    private readonly serviceRepo: IServiceRepository,
    private readonly itemRepo: IItemRepository,
  ) {}

  async execute(os: ServiceOrder): Promise<number> {
    let total = 0;

    for (const osService of os.services) {
      const service = await this.serviceRepo.findById(osService.serviceId);
      if (service) total += service.price;
    }

    for (const osItem of os.items) {
      const item = await this.itemRepo.findById(osItem.itemId);
      if (item) total += item.price * osItem.quantity;
    }

    return total;
  }
}
