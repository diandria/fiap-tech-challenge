import { ServiceOrder } from '../../../entities/ServiceOrder';

export interface CreateServiceOrderInput {
  customerId: string;
  vehicleId: string;
  services?: string[];
  items?: { itemId: string; quantity: number }[];
}

export interface ICreateServiceOrder {
  execute(input: CreateServiceOrderInput): Promise<ServiceOrder>;
}
