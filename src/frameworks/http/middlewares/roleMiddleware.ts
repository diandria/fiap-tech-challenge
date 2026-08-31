import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../../entities/User';
import { ForbiddenError } from '../../../entities/errors/AppError';

/**
 * Authorises by employee role.
 *
 * Rejecting a customer token is explicit, not a side effect of it having no
 * `role`. Without the `type` check a customer would be blocked by accident --
 * falling into `roles.includes(undefined)` -- and a future refactor could
 * dissolve the accident with nobody noticing the door had opened.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || req.user.type !== 'staff' || !roles.includes(req.user.role)) {
      return next(new ForbiddenError());
    }
    next();
  };
}

/**
 * Authorises routes only a customer may reach.
 *
 * Rejecting employees is deliberate, not an oversight: customer routes decide
 * about the customer's *own* order, and the ownership comparison needs the
 * token's `sub`. An admin has no `sub`, so there is no owner to compare
 * against -- letting one through would turn the next check into a silent no-op.
 *
 * An employee who needs to see a customer's order uses the staff routes, which
 * carry their own role rules.
 */
export function requireCustomer(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.type !== 'customer') {
    return next(new ForbiddenError());
  }
  next();
}
