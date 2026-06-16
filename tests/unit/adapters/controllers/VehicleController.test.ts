import { VehicleController } from '../../../../src/adapters/controllers/VehicleController';
import { Request, Response } from 'express';

function makeRes() {
  return { json: jest.fn(), status: jest.fn().mockReturnThis(), sendStatus: jest.fn() } as unknown as Response;
}

const vehicle = { id: 'v1', customerId: 'c1', plate: 'ABC1234', brand: 'Ford', model: 'Ka', year: 2020 };

function makeController() {
  const fns = {
    createVehicle: jest.fn().mockResolvedValue(vehicle),
    getVehicle: jest.fn().mockResolvedValue(vehicle),
    listVehicles: jest.fn().mockResolvedValue([vehicle]),
    updateVehicle: jest.fn().mockResolvedValue(vehicle),
    deleteVehicle: jest.fn().mockResolvedValue(undefined),
  };
  return {
    controller: new VehicleController(
      { execute: fns.createVehicle } as any, { execute: fns.getVehicle } as any,
      { execute: fns.listVehicles } as any, { execute: fns.updateVehicle } as any,
      { execute: fns.deleteVehicle } as any,
    ),
    fns,
  };
}

describe('VehicleController', () => {
  it('list: passes customerId query and returns 200', async () => {
    const { controller, fns } = makeController();
    const req = { query: { customerId: 'c1' } } as unknown as Request;
    const res = makeRes();
    await controller.list(req, res, jest.fn());
    expect(fns.listVehicles).toHaveBeenCalledWith('c1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([vehicle]);
  });

  it('create: returns 201', async () => {
    const { controller } = makeController();
    const res = makeRes();
    await controller.create({ body: {} } as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('delete: sends 204', async () => {
    const { controller } = makeController();
    const req = { params: { id: 'v1' } } as unknown as Request;
    const res = makeRes();
    await controller.delete(req, res, jest.fn());
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });
});
