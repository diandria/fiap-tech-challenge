import { ItemController } from '../../../../src/adapters/controllers/ItemController';
import { Request, Response } from 'express';

function makeRes() {
  return { json: jest.fn(), status: jest.fn().mockReturnThis(), sendStatus: jest.fn() } as unknown as Response;
}

const item = { id: 'i1', name: 'Oil Filter', price: 30, stockQuantity: 10, reservedQuantity: 2 };

function makeController() {
  const fns = {
    createItem: jest.fn().mockResolvedValue(item),
    getItem: jest.fn().mockResolvedValue(item),
    listItems: jest.fn().mockResolvedValue([item]),
    updateItem: jest.fn().mockResolvedValue(item),
    deleteItem: jest.fn().mockResolvedValue(undefined),
  };
  return {
    controller: new ItemController(
      { execute: fns.createItem } as any, { execute: fns.getItem } as any,
      { execute: fns.listItems } as any, { execute: fns.updateItem } as any,
      { execute: fns.deleteItem } as any,
    ),
    fns,
  };
}

describe('ItemController', () => {
  it('list: returns 200 with items array', async () => {
    const { controller, fns } = makeController();
    const res = makeRes();
    await controller.list({} as Request, res, jest.fn());
    expect(fns.listItems).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([item]);
  });

  it('create: returns 201', async () => {
    const { controller } = makeController();
    const res = makeRes();
    await controller.create({ body: {} } as Request, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('delete: sends 204', async () => {
    const { controller } = makeController();
    const req = { params: { id: 'i1' } } as unknown as Request;
    const res = makeRes();
    await controller.delete(req, res, jest.fn());
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });
});
