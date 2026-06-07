import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../../entities/User';
import { ForbiddenError } from '../../../entities/errors/AppError';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ForbiddenError());
    }
    next();
  };
}
