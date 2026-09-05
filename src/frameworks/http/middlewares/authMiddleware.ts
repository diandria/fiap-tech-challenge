import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../../../entities/User';
import { UnauthorizedError } from '../../../entities/errors/AppError';

/**
 * Shop employee, authenticated with e-mail and password at `POST /auth/login`.
 */
export interface StaffJwtPayload {
  type: 'staff';
  userId: string;
  role: UserRole;
}

/**
 * Customer, authenticated by CPF in the issuing function (ADR-002). `sub` is
 * the `customerId`, and it is the only accepted source for it: taken from the
 * body or the query string, the ownership check would be decorative.
 */
export interface CustomerJwtPayload {
  type: 'customer';
  sub: string;
  cpf: string;
  name: string;
}

/**
 * Union discriminated by `type`. Discriminating instead of piling up optional
 * fields makes the compiler demand narrowing before any access: there is no way
 * to read `role` off a customer token without it complaining.
 */
export type JwtPayload = StaffJwtPayload | CustomerJwtPayload;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Normalises whatever was signed into the union, or returns null when the token
 * describes neither actor.
 */
function toPayload(raw: Record<string, unknown>): JwtPayload | null {
  // Tokens issued before this change carry no `type` and were all staff tokens;
  // the default keeps them working.
  const type = raw.type ?? 'staff';

  if (type === 'staff') {
    if (typeof raw.userId !== 'string' || typeof raw.role !== 'string') return null;
    return { type: 'staff', userId: raw.userId, role: raw.role as UserRole };
  }

  if (type === 'customer') {
    // Without `sub` the ownership check would compare against undefined.
    if (typeof raw.sub !== 'string') return null;
    return {
      type: 'customer',
      sub: raw.sub,
      cpf: typeof raw.cpf === 'string' ? raw.cpf : '',
      name: typeof raw.name === 'string' ? raw.name : '',
    };
  }

  return null;
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError());
  }
  const token = header.split(' ')[1];
  let raw: Record<string, unknown>;
  try {
    raw = jwt.verify(token, process.env.JWT_SECRET!) as Record<string, unknown>;
  } catch {
    return next(new UnauthorizedError('Invalid or expired token'));
  }

  const payload = toPayload(raw);
  if (!payload) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }

  req.user = payload;
  next();
}
