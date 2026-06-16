import { AuthController } from '../../../../src/adapters/controllers/AuthController';
import { Request, Response } from 'express';

function makeRes() {
  return { json: jest.fn(), status: jest.fn().mockReturnThis(), sendStatus: jest.fn() } as unknown as Response;
}

describe('AuthController', () => {
  it('login: calls loginUseCase with req.body and responds 200', async () => {
    const loginUseCase = { execute: jest.fn().mockResolvedValue({ token: 'jwt' }) };
    const controller = new AuthController(loginUseCase as any, {} as any);
    const req = { body: { email: 'a@a.com', password: '123' } } as Request;
    const res = makeRes();
    await controller.login(req, res, jest.fn());
    expect(loginUseCase.execute).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ token: 'jwt' });
  });

  it('register: calls registerUseCase with req.body and responds 201', async () => {
    const user = { id: 'u1', email: 'a@a.com', role: 'admin' };
    const registerUseCase = { execute: jest.fn().mockResolvedValue(user) };
    const controller = new AuthController({} as any, registerUseCase as any);
    const req = { body: { email: 'a@a.com', password: '123', role: 'admin' } } as Request;
    const res = makeRes();
    await controller.register(req, res, jest.fn());
    expect(registerUseCase.execute).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(user);
  });

  it('login: calls next on error', async () => {
    const err = new Error('bad');
    const controller = new AuthController({ execute: jest.fn().mockRejectedValue(err) } as any, {} as any);
    const next = jest.fn();
    await controller.login({ body: {} } as Request, makeRes(), next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
