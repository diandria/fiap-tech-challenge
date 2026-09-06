import { ServiceOrder } from '../../../entities/ServiceOrder';

/**
 * A status transition that needs nothing but the service order. Budget
 * decisions stay out because they take a second argument; see IDecideBudget.
 */
export interface IChangeServiceOrderStatus {
  execute(osId: string): Promise<ServiceOrder>;
}
