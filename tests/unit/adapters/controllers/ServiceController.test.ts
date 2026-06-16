import { ServiceController } from '../../../../src/adapters/controllers/ServiceController';
import { Request, Response } from 'express';

function makeRes() {
  return { json: jest.fn(), status: jest.fn().mockReturnThis(), sendStatus: jest.fn() } as unknown as Response;
}

const service = { id: 's1', name: 'Oil Change', price: 80, estimatedMinutes: 60 };

function makeController() {
  const fns = {
    createService: jest.fn().mockResolvedValue(service),
    getService: jest.fn().mockResolvedValue(service),
    listServices: jest.fn().mockResolvedValue([service]),
    listServicesAvgTime: jest.fn().mockResolvedValue([{ id: 's1', name: 'Oil Change', estimatedMinutes: 60 }]),
    updateService: jest.fn().mockResolvedValue(service),
    deleteService: jest.fn().mockResolvedValue(undefined),
  };
  return {
    controller: new ServiceController(
      { execute: fns.createService } as any, { execute: fns.getService } as any,
      { execute: fns.listServices } as any, { execute: fns.listServicesAvgTime } as any,
      { execute: fns.updateService } as any, { execute: fns.deleteService } as any,
    ),
    fns,
  };
}

describe('ServiceController', () => {
  it('list: returns 200 with services array', async () => {
    const { controller, fns } = makeController();
    const res = makeRes();
    await controller.list({} as Request, res, jest.fn());
    expect(fns.listServices).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([service]);
  });

  it('listAvgTime: returns 200 with avg time array', async () => {
    const { controller, fns } = makeController();
    const res = makeRes();
    await controller.listAvgTime({} as Request, res, jest.fn());
    expect(fns.listServicesAvgTime).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('create: returns 201', async () => {
    const { controller } = makeController();
    const res = makeRes();
    await controller.create({ body: {} } as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('delete: sends 204', async () => {
    const { controller } = makeController();
    const req = { params: { id: 's1' } } as unknown as Request;
    const res = makeRes();
    await controller.delete(req, res, jest.fn());
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });
});
