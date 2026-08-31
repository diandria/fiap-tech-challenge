import { Request, Response, NextFunction } from 'express';
import { requireRole, requireCustomer } from '../../../../src/frameworks/http/middlewares/roleMiddleware';
import { ForbiddenError } from '../../../../src/entities/errors/AppError';
import { JwtPayload } from '../../../../src/frameworks/http/middlewares/authMiddleware';

const staff = (role: 'admin' | 'attendant' | 'mechanic'): JwtPayload => ({
  type: 'staff',
  userId: 'u1',
  role,
});

const customer: JwtPayload = { type: 'customer', sub: 'c1', cpf: '52998224725', name: 'Ana' };

function reqAs(user?: JwtPayload): Request {
  return { user } as Request;
}

describe('requireRole', () => {
  it('should allow GIVEN a staff token with an accepted role WHEN authorizing', () => {
    const next = jest.fn() as NextFunction;

    requireRole('admin')(reqAs(staff('admin')), {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should reject GIVEN a staff token with another role WHEN authorizing', () => {
    const next = jest.fn() as NextFunction;

    requireRole('admin')(reqAs(staff('mechanic')), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  // The refusal must come from a decision, not from a customer token happening
  // to have no `role`. This test pins the intent: if a future refactor
  // dissolves the accident, it breaks.
  it('should reject a customer token GIVEN a staff-only route WHEN authorizing', () => {
    const next = jest.fn() as NextFunction;

    requireRole('admin')(reqAs(customer), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('should reject GIVEN no authenticated user WHEN authorizing', () => {
    const next = jest.fn() as NextFunction;

    requireRole('admin')(reqAs(undefined), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});

describe('requireCustomer', () => {
  it('should allow a customer token GIVEN a customer-only route WHEN authorizing', () => {
    const next = jest.fn() as NextFunction;

    requireCustomer(reqAs(customer), {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  // Deliberate symmetry: an admin does not pass either. The route belongs to
  // the order's owner, and whoever has no `sub` has no owner to compare.
  it('should reject a staff token GIVEN a customer-only route WHEN authorizing', () => {
    const next = jest.fn() as NextFunction;

    requireCustomer(reqAs(staff('admin')), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('should reject GIVEN no authenticated user WHEN authorizing', () => {
    const next = jest.fn() as NextFunction;

    requireCustomer(reqAs(undefined), {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
