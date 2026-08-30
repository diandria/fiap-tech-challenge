import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { findOSOrThrow } from '../utils/serviceOrderUtils';
import { assertOwnership } from '../utils/ownership';

export interface GetServiceOrderInput {
  osId: string;
  /**
   * Preenchido a partir do `sub` do token quando quem pede e um cliente.
   * Ausente numa chamada de funcionario, que enxerga qualquer OS.
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
