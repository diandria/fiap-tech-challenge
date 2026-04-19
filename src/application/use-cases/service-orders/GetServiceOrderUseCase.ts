import { IServiceOrderRepository } from '../../../domain/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../domain/entities/ServiceOrder';
import { findOSOrThrow } from '../../utils/serviceOrderUtils';

export class GetServiceOrderUseCase {
  constructor(private readonly repo: IServiceOrderRepository) {}

  async execute(id: string): Promise<ServiceOrder> {
    return findOSOrThrow(this.repo, id);
  }
}
