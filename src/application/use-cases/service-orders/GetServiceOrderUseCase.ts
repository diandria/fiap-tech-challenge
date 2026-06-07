import { IServiceOrderRepository } from '../../../use-cases/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../entities/ServiceOrder';
import { findOSOrThrow } from '../../utils/serviceOrderUtils';

export class GetServiceOrderUseCase {
  constructor(private readonly repo: IServiceOrderRepository) {}

  async execute(id: string): Promise<ServiceOrder> {
    return findOSOrThrow(this.repo, id);
  }
}
