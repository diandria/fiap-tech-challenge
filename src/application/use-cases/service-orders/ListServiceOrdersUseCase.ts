import { IServiceOrderRepository, ListServiceOrdersFilter } from '../../../use-cases/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../entities/ServiceOrder';

export class ListServiceOrdersUseCase {
  constructor(private readonly repo: IServiceOrderRepository) {}

  async execute(filter?: ListServiceOrdersFilter): Promise<ServiceOrder[]> {
    return this.repo.findAll(filter);
  }
}
