import { IServiceOrderRepository } from '../../../use-cases/ports/IServiceOrderRepository';
import { ServiceOrder } from '../../../entities/ServiceOrder';

interface CreateServiceOrderInput {
  customerId: string;
  vehicleId: string;
}

export class CreateServiceOrderUseCase {
  constructor(private readonly repo: IServiceOrderRepository) {}

  async execute(input: CreateServiceOrderInput): Promise<ServiceOrder> {
    return this.repo.create({
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      status: 'RECEIVED',
      services: [],
      items: [],
    });
  }
}
