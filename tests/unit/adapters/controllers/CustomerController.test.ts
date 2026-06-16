import { CustomerController } from '../../../../src/adapters/controllers/CustomerController';
import { Request, Response } from 'express';
import { cpfCustomer } from '../../fixtures/customer';

function makeRes() {
  return { json: jest.fn(), status: jest.fn().mockReturnThis(), sendStatus: jest.fn() } as unknown as Response;
}

function makeController(overrides: Record<string, jest.Mock> = {}) {
  const defaults = {
    createCustomer: jest.fn().mockResolvedValue(cpfCustomer),
    getCustomerById: jest.fn().mockResolvedValue(cpfCustomer),
    getCustomerByTaxId: jest.fn().mockResolvedValue(cpfCustomer),
    listCustomers: jest.fn().mockResolvedValue([cpfCustomer]),
    updateCustomer: jest.fn().mockResolvedValue(cpfCustomer),
    deleteCustomer: jest.fn().mockResolvedValue(undefined),
  };
  const fns = { ...defaults, ...overrides };
  return {
    controller: new CustomerController(
      { execute: fns.createCustomer } as any,
      { execute: fns.getCustomerById } as any,
      { execute: fns.getCustomerByTaxId } as any,
      { execute: fns.listCustomers } as any,
      { execute: fns.updateCustomer } as any,
      { execute: fns.deleteCustomer } as any,
    ),
    fns,
  };
}

describe('CustomerController', () => {
  it('list: returns 200 with array', async () => {
    const { controller, fns } = makeController();
    const res = makeRes();
    await controller.list({} as Request, res, jest.fn());
    expect(fns.listCustomers).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([cpfCustomer]);
  });

  it('create: calls createCustomer with req.body and returns 201', async () => {
    const { controller, fns } = makeController();
    const req = { body: { name: 'Joao' } } as Request;
    const res = makeRes();
    await controller.create(req, res, jest.fn());
    expect(fns.createCustomer).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(cpfCustomer);
  });

  it('getById: calls getCustomerById with req.params.id and returns 200', async () => {
    const { controller, fns } = makeController();
    const req = { params: { id: cpfCustomer.id } } as unknown as Request;
    const res = makeRes();
    await controller.getById(req, res, jest.fn());
    expect(fns.getCustomerById).toHaveBeenCalledWith(cpfCustomer.id);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('getByTaxId: calls getCustomerByTaxId with req.params.taxId and returns 200', async () => {
    const { controller, fns } = makeController();
    const req = { params: { taxId: cpfCustomer.taxId } } as unknown as Request;
    const res = makeRes();
    await controller.getByTaxId(req, res, jest.fn());
    expect(fns.getCustomerByTaxId).toHaveBeenCalledWith(cpfCustomer.taxId);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('update: calls updateCustomer with id and body, returns 200', async () => {
    const { controller, fns } = makeController();
    const req = { params: { id: cpfCustomer.id }, body: { name: 'Maria' } } as unknown as Request;
    const res = makeRes();
    await controller.update(req, res, jest.fn());
    expect(fns.updateCustomer).toHaveBeenCalledWith(cpfCustomer.id, { name: 'Maria' });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('delete: calls deleteCustomer with id and sends 204', async () => {
    const { controller, fns } = makeController();
    const req = { params: { id: cpfCustomer.id } } as unknown as Request;
    const res = makeRes();
    await controller.delete(req, res, jest.fn());
    expect(fns.deleteCustomer).toHaveBeenCalledWith(cpfCustomer.id);
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });

  it('create: calls next on error', async () => {
    const err = new Error('boom');
    const { controller } = makeController({ createCustomer: jest.fn().mockRejectedValue(err) });
    const next = jest.fn();
    await controller.create({ body: {} } as Request, makeRes(), next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
