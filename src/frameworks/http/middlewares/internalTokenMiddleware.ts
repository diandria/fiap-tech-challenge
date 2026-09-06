import { timingSafeEqual } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../../entities/errors/AppError';

/**
 * Guard for the internal lookup endpoint, consumed by the authentication
 * function. The comparison is constant-time to avoid leaking the secret
 * through response timing.
 */
export function internalTokenMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const provided = Buffer.from(String(req.headers['x-internal-token'] ?? ''));
  const expected = Buffer.from(process.env.INTERNAL_TOKEN ?? '');

  // With no secret configured there is no valid comparison: accepting an empty
  // string would open the route on a deploy with a missing variable.
  if (expected.length === 0 || provided.length !== expected.length) {
    return next(new UnauthorizedError());
  }
  if (!timingSafeEqual(provided, expected)) {
    return next(new UnauthorizedError());
  }
  next();
}
