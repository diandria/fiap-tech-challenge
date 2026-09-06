import { ServiceOrder } from '../../entities/ServiceOrder';
import { ForbiddenError } from '../../entities/errors/AppError';

/**
 * Service order ownership.
 *
 * It lives in the application layer, not in a middleware, because it is a
 * business rule: deciding it needs the repository, and querying from a
 * middleware would put use case work in the frameworks layer.
 *
 * A missing `requesterCustomerId` means a staff call, already authorised by
 * the route's `requireRole`.
 */
export function assertOwnership(os: ServiceOrder, requesterCustomerId?: string): void {
  if (requesterCustomerId && os.customerId !== requesterCustomerId) {
    throw new ForbiddenError();
  }
}
