import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { ServiceOrderStatusChange } from '../../entities/ServiceOrderStatusChange';
import { findOSOrThrow } from '../utils/serviceOrderUtils';
import { assertOwnership } from '../utils/ownership';
import { GetServiceOrderInput } from './GetServiceOrderUseCase';

export interface ServiceOrderHistory {
  serviceOrderId: string;
  history: ServiceOrderStatusChange[];
}

export class GetServiceOrderHistoryUseCase {
  constructor(private readonly repo: IServiceOrderRepository) {}

  async execute(input: GetServiceOrderInput): Promise<ServiceOrderHistory> {
    const os = await findOSOrThrow(this.repo, input.osId);
    assertOwnership(os, input.requesterCustomerId);

    const history = await this.repo.findStatusHistory(os.id);
    return { serviceOrderId: os.id, history };
  }
}
