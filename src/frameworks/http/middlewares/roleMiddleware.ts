import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../../entities/User';
import { ForbiddenError } from '../../../entities/errors/AppError';

/**
 * Autoriza por perfil de funcionario.
 *
 * A recusa a token de cliente e explicita, e nao consequencia de ele nao ter
 * `role`. Sem a checagem de `type`, um cliente seria barrado por acidente --
 * cairia em `roles.includes(undefined)` -- e um refactor futuro poderia
 * dissolver o acidente sem ninguem perceber que a porta abriu.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || req.user.type !== 'staff' || !roles.includes(req.user.role)) {
      return next(new ForbiddenError());
    }
    next();
  };
}
