import { IServiceOrderRepository, ListServiceOrdersFilter } from '../ports/IServiceOrderRepository';
import { ServiceOrder } from '../../entities/ServiceOrder';

export class ListServiceOrdersUseCase {
  constructor(private readonly repo: IServiceOrderRepository) {}

  async execute(filter?: ListServiceOrdersFilter): Promise<ServiceOrder[]> {
    return this.repo.findAll(filter);
  }
}
