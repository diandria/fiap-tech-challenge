import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { findOSOrThrow } from '../utils/serviceOrderUtils';
import { assertOwnership } from '../utils/ownership';

export interface GetServiceOrderInput {
  osId: string;
  /**
   * Filled from the token's `sub` when the requester is a customer. Absent on
   * an employee call, which may see any order.
   */
  requesterCustomerId?: string;
}

export class GetServiceOrderUseCase {
  constructor(private readonly repo: IServiceOrderRepository) {}

  async execute(input: GetServiceOrderInput): Promise<ServiceOrder> {
    const os = await findOSOrThrow(this.repo, input.osId);
    assertOwnership(os, input.requesterCustomerId);
    return os;
  }
}
