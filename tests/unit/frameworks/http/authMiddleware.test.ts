import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../../../src/frameworks/http/middlewares/authMiddleware';
import { UnauthorizedError } from '../../../../src/entities/errors/AppError';

const SECRET = 'unit-test-secret';

function reqWithToken(payload: object): Request {
  const token = jwt.sign(payload, SECRET);
  return { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
}

describe('authMiddleware', () => {
  const original = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  afterAll(() => {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  });

  it('should populate a staff payload GIVEN a staff token WHEN authenticating', () => {
    const req = reqWithToken({ type: 'staff', userId: 'u1', role: 'admin' });

    authMiddleware(req, {} as Response, jest.fn() as NextFunction);

    expect(req.user).toEqual(expect.objectContaining({ type: 'staff', userId: 'u1', role: 'admin' }));
  });

  it('should populate a customer payload GIVEN a customer token WHEN authenticating', () => {
    const req = reqWithToken({ type: 'customer', sub: 'c1', cpf: '52998224725', name: 'Ana' });

    authMiddleware(req, {} as Response, jest.fn() as NextFunction);

    expect(req.user).toEqual(
      expect.objectContaining({ type: 'customer', sub: 'c1', cpf: '52998224725', name: 'Ana' }),
    );
  });

  // Without this fallback, every token issued before this change would stop
  // working at once -- including the ones in the integration suite.
  it('should default to staff GIVEN a legacy token without type WHEN authenticating', () => {
    const req = reqWithToken({ userId: 'u1', role: 'admin' });

    authMiddleware(req, {} as Response, jest.fn() as NextFunction);

    expect(req.user?.type).toBe('staff');
  });

  it('should reject GIVEN no authorization header WHEN authenticating', () => {
    const next = jest.fn() as NextFunction;

    authMiddleware({ headers: {} } as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('should reject GIVEN a token signed with another secret WHEN authenticating', () => {
    const token = jwt.sign({ type: 'staff', userId: 'u1', role: 'admin' }, 'outro-segredo');
    const next = jest.fn() as NextFunction;

    authMiddleware(
      { headers: { authorization: `Bearer ${token}` } } as unknown as Request,
      {} as Response,
      next,
    );

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  // A customer token without `sub` would pass the ownership check by comparing
  // against undefined. Refusing at the door is cheaper than finding out later
  // why one customer saw another customer's service order.
  it('should reject GIVEN a customer token without sub WHEN authenticating', () => {
    const next = jest.fn() as NextFunction;

    authMiddleware(reqWithToken({ type: 'customer', cpf: '52998224725' }), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('should reject GIVEN a staff token without userId WHEN authenticating', () => {
    const next = jest.fn() as NextFunction;

    authMiddleware(reqWithToken({ type: 'staff', role: 'admin' }), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('should reject GIVEN an unknown type WHEN authenticating', () => {
    const next = jest.fn() as NextFunction;

    authMiddleware(reqWithToken({ type: 'parceiro', sub: 'p1' }), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
