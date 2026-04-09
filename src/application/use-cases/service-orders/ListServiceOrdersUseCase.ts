import { IServiceOrderRepository, ListServiceOrdersFilter } from '../../../domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';

export class ListServiceOrdersUseCase {
  constructor(private readonly repo: IServiceOrderRepository) {}

  async execute(filter?: ListServiceOrdersFilter): Promise<ServiceOrder[]> {
    return this.repo.findAll(filter);
  }
}
