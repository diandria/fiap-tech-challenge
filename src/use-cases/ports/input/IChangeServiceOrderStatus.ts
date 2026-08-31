import { ServiceOrder } from '../../../entities/ServiceOrder';

/**
 * A status transition that needs nothing but the service order.
 *
 * It serves StartDiagnosis, FinishDiagnosis, StartExecution, FinishOS and
 * DeliverOS, which are exactly the five entries of the controller's
 * statusHandlers map. Budget decisions stay out because they require a second
 * argument; see IDecideBudget.
 */
export interface IChangeServiceOrderStatus {
  execute(osId: string): Promise<ServiceOrder>;
}
