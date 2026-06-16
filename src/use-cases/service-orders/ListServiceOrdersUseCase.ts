import { IServiceOrderRepository, ListServiceOrdersFilter } from '../ports/IServiceOrderRepository';
import { ServiceOrder, OSStatus } from '../../entities/ServiceOrder';

export class ListServiceOrdersUseCase {
  constructor(private readonly repo: IServiceOrderRepository) {}

  private readonly STATUS_PRIORITY: Partial<Record<OSStatus, number>> = {
    EXECUTION: 1,
    WAITING_APPROVAL: 2,
    DIAGNOSIS: 3,
    RECEIVED: 4,
  };

  private sortByPriority(orders: ServiceOrder[]): ServiceOrder[] {
    return [...orders].sort((a, b) => {
      const pa = this.STATUS_PRIORITY[a.status] ?? 99;
      const pb = this.STATUS_PRIORITY[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  async execute(filter?: ListServiceOrdersFilter): Promise<ServiceOrder[]> {
    const activeFilter: ListServiceOrdersFilter = {
      ...filter,
      excludeStatuses: filter?.status ? undefined : ['FINISHED', 'DELIVERED'],
    };
    const orders = await this.repo.findAll(activeFilter);
    return this.sortByPriority(orders);
  }
}
