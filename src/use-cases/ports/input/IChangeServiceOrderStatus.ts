import { ServiceOrder } from '../../../entities/ServiceOrder';

/** A status transition that needs nothing but the service order. */
export interface IChangeServiceOrderStatus {
  execute(osId: string): Promise<ServiceOrder>;
}
