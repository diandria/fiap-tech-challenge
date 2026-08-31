import { Request, Response, NextFunction } from 'express';
import { internalTokenMiddleware } from '../../../../src/frameworks/http/middlewares/internalTokenMiddleware';
import { UnauthorizedError } from '../../../../src/entities/errors/AppError';

const SECRET = 'shared-internal-token';

function reqWith(token?: string): Request {
  return { headers: token === undefined ? {} : { 'x-internal-token': token } } as unknown as Request;
}

describe('internalTokenMiddleware', () => {
  const original = process.env.INTERNAL_TOKEN;

  beforeEach(() => {
    process.env.INTERNAL_TOKEN = SECRET;
  });

  afterAll(() => {
    if (original === undefined) delete process.env.INTERNAL_TOKEN;
    else process.env.INTERNAL_TOKEN = original;
  });

  it('should call next with no error GIVEN the exact token WHEN validating', () => {
    const next = jest.fn() as NextFunction;

    internalTokenMiddleware(reqWith(SECRET), {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should reject GIVEN no token header WHEN validating', () => {
    const next = jest.fn() as NextFunction;

    internalTokenMiddleware(reqWith(), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('should reject GIVEN a token of the same length but different content WHEN validating', () => {
    const next = jest.fn() as NextFunction;

    internalTokenMiddleware(reqWith('X'.repeat(SECRET.length)), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('should reject GIVEN a token that is a prefix of the secret WHEN validating', () => {
    const next = jest.fn() as NextFunction;

    internalTokenMiddleware(reqWith(SECRET.slice(0, -1)), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  // A deploy without the variable must not open the route. Accepting an empty
  // string would turn a missing configuration into an unlocked door.
  it('should reject every request GIVEN the secret is not configured WHEN validating', () => {
    delete process.env.INTERNAL_TOKEN;
    const next = jest.fn() as NextFunction;

    internalTokenMiddleware(reqWith(''), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
