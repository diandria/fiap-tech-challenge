import { ServiceOrder } from '../../entities/ServiceOrder';
import { ForbiddenError } from '../../entities/errors/AppError';

/**
 * Service order ownership.
 *
 * It lives in the application layer, and not in a middleware, because it is a
 * business rule. A middleware would have no way of knowing who owns the order
 * without querying the repository -- and if it did query, it would be doing use
 * case work inside the frameworks layer.
 *
 * That is also what makes it portable: when the service order context becomes
 * its own service, the rule travels with it. Living in the gateway, it would be
 * left behind by the extraction, and the new service would be born trusting
 * that somebody upstream had validated.
 *
 * A missing `requesterCustomerId` means an employee call, which has already
 * passed the route's `requireRole`. Not restricting here is deliberate: without
 * it, every staff route would have to supply a fictitious owner.
 */
export function assertOwnership(os: ServiceOrder, requesterCustomerId?: string): void {
  if (requesterCustomerId && os.customerId !== requesterCustomerId) {
    throw new ForbiddenError();
  }
}
