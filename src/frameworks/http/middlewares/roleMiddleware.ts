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

/**
 * Autoriza rotas que so um cliente pode acessar.
 *
 * Recusa funcionario de proposito, e nao por descuido: as rotas de cliente
 * decidem sobre a *propria* OS, e a comparacao de titularidade precisa do `sub`
 * do token. Um admin nao tem `sub`, entao nao ha dono contra quem comparar --
 * deixa-lo passar seria transformar a checagem seguinte num no-op silencioso.
 *
 * Funcionario que precise ver a OS de um cliente usa as rotas de staff, que
 * tem as proprias regras de perfil.
 */
export function requireCustomer(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.type !== 'customer') {
    return next(new ForbiddenError());
  }
  next();
}
