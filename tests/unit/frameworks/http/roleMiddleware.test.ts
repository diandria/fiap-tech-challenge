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

  // A recusa precisa ser por decisao, nao por o token de cliente nao ter
  // `role`. Este teste fixa a intencao: se um refactor futuro dissolver o
  // acidente, ele quebra.
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

  // Simetria deliberada: um admin tambem nao passa. A rota e do dono da OS, e
  // quem nao tem `sub` nao tem dono para comparar.
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
