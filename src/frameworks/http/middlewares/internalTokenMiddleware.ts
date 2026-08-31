import { timingSafeEqual } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../../entities/errors/AppError';

/**
 * Guard for the internal lookup endpoint, consumed by the authentication
 * function.
 *
 * The comparison is constant-time, not `===`, on purpose. With `===` the
 * response time varies with how many leading characters match, and the secret
 * can be recovered one character at a time by whoever measures. Doing it right
 * here costs one line.
 */
export function internalTokenMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const provided = Buffer.from(String(req.headers['x-internal-token'] ?? ''));
  const expected = Buffer.from(process.env.INTERNAL_TOKEN ?? '');

  // With no secret configured there is no valid comparison: denying is the
  // only safe answer. Accepting an empty string would open the whole route on a
  // deploy with a missing variable.
  if (expected.length === 0 || provided.length !== expected.length) {
    return next(new UnauthorizedError());
  }
  if (!timingSafeEqual(provided, expected)) {
    return next(new UnauthorizedError());
  }
  next();
}
