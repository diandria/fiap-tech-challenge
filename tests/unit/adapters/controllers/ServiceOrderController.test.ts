import { ServiceOrderController } from '../../../../src/adapters/controllers/ServiceOrderController';
import { Request, Response } from 'express';
import { baseOS } from '../../fixtures/serviceOrder';

function makeRes() {
  return { json: jest.fn(), status: jest.fn().mockReturnThis(), sendStatus: jest.fn() } as unknown as Response;
}

const os = baseOS;

function makeUseCases() {
  return {
    createOS: jest.fn().mockResolvedValue(os),
    getOS: jest.fn().mockResolvedValue(os),
    listOS: jest.fn().mockResolvedValue([os]),
    addService: jest.fn().mockResolvedValue(os),
    removeService: jest.fn().mockResolvedValue(os),
    addItem: jest.fn().mockResolvedValue(os),
    removeItem: jest.fn().mockResolvedValue(os),
    startDiagnosis: jest.fn().mockResolvedValue(os),
    finishDiagnosis: jest.fn().mockResolvedValue(os),
    approveBudget: jest.fn().mockResolvedValue(os),
    rejectBudget: jest.fn().mockResolvedValue(os),
    startExecution: jest.fn().mockResolvedValue(os),
    startService: jest.fn().mockResolvedValue(os),
    finishService: jest.fn().mockResolvedValue(os),
    finishOS: jest.fn().mockResolvedValue(os),
    deliverOS: jest.fn().mockResolvedValue(os),
    getAvgExecution: jest.fn().mockResolvedValue([]),
  };
}

function makeController(fns = makeUseCases()) {
  return new ServiceOrderController(
    { execute: fns.createOS } as any, { execute: fns.getOS } as any, { execute: fns.listOS } as any,
    { execute: fns.addService } as any, { execute: fns.removeService } as any,
    { execute: fns.addItem } as any, { execute: fns.removeItem } as any,
    { execute: fns.startDiagnosis } as any, { execute: fns.finishDiagnosis } as any,
    { execute: fns.approveBudget } as any, { execute: fns.rejectBudget } as any,
    { execute: fns.startExecution } as any, { execute: fns.startService } as any,
    { execute: fns.finishService } as any, { execute: fns.finishOS } as any,
    { execute: fns.deliverOS } as any, { execute: fns.getAvgExecution } as any,
  );
}

describe('ServiceOrderController', () => {
  it('getStatus: returns 200 with id, status and budgetTotal', async () => {
    const fns = makeUseCases();
    const controller = makeController(fns);
    const req = { params: { id: os.id } } as unknown as Request;
    const res = makeRes();
    await controller.getStatus(req, res, jest.fn());
    expect(fns.getOS).toHaveBeenCalledWith(os.id);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ id: os.id, status: os.status, budgetTotal: os.budgetTotal });
  });

  it('create: returns 201 with OS', async () => {
    const fns = makeUseCases();
    const controller = makeController(fns);
    const req = { body: { customerId: 'c1', vehicleId: 'v1' } } as Request;
    const res = makeRes();
    await controller.create(req, res, jest.fn());
    expect(fns.createOS).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(os);
  });

  it('list: passes filter from query params and returns 200', async () => {
    const fns = makeUseCases();
    const controller = makeController(fns);
    const req = { query: { status: 'RECEIVED', customerId: 'c1' } } as unknown as Request;
    const res = makeRes();
    await controller.list(req, res, jest.fn());
    expect(fns.listOS).toHaveBeenCalledWith({ status: 'RECEIVED', customerId: 'c1', from: undefined, to: undefined });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('updateStatus DIAGNOSIS: calls startDiagnosis', async () => {
    const fns = makeUseCases();
    const controller = makeController(fns);
    const req = { params: { id: os.id }, body: { status: 'DIAGNOSIS' } } as unknown as Request;
    await controller.updateStatus(req, makeRes(), jest.fn());
    expect(fns.startDiagnosis).toHaveBeenCalledWith(os.id);
  });

  it('updateStatus WAITING_APPROVAL: calls finishDiagnosis', async () => {
    const fns = makeUseCases();
    const controller = makeController(fns);
    const req = { params: { id: os.id }, body: { status: 'WAITING_APPROVAL' } } as unknown as Request;
    await controller.updateStatus(req, makeRes(), jest.fn());
    expect(fns.finishDiagnosis).toHaveBeenCalledWith(os.id);
  });

  it('updateStatus EXECUTION: calls startExecution', async () => {
    const fns = makeUseCases();
    const controller = makeController(fns);
    const req = { params: { id: os.id }, body: { status: 'EXECUTION' } } as unknown as Request;
    await controller.updateStatus(req, makeRes(), jest.fn());
    expect(fns.startExecution).toHaveBeenCalledWith(os.id);
  });

  it('budgetDecision APPROVED: calls approveBudget with code', async () => {
    const fns = makeUseCases();
    const controller = makeController(fns);
    const req = { params: { id: os.id }, body: { status: 'APPROVED', code: '5299' } } as unknown as Request;
    await controller.budgetDecision(req, makeRes(), jest.fn());
    expect(fns.approveBudget).toHaveBeenCalledWith(os.id, '5299');
  });

  it('budgetDecision REJECTED: calls rejectBudget with code', async () => {
    const fns = makeUseCases();
    const controller = makeController(fns);
    const req = { params: { id: os.id }, body: { status: 'REJECTED', code: '5299' } } as unknown as Request;
    await controller.budgetDecision(req, makeRes(), jest.fn());
    expect(fns.rejectBudget).toHaveBeenCalledWith(os.id, '5299');
  });

  it('updateStatus with missing status: calls next with ValidationError', async () => {
    const controller = makeController();
    const next = jest.fn();
    await controller.updateStatus({ params: { id: os.id }, body: {} } as unknown as Request, makeRes(), next);
    expect(next).toHaveBeenCalled();
    expect((next.mock.calls[0][0] as Error).message).toBe('status is required');
  });

  it('addServiceToOS: calls addService with osId and serviceId', async () => {
    const fns = makeUseCases();
    const controller = makeController(fns);
    const req = { params: { id: os.id }, body: { serviceId: 's1' } } as unknown as Request;
    await controller.addServiceToOS(req, makeRes(), jest.fn());
    expect(fns.addService).toHaveBeenCalledWith(os.id, 's1');
  });

  it('addItemToOS: calls addItem with osId, itemId and quantity', async () => {
    const fns = makeUseCases();
    const controller = makeController(fns);
    const req = { params: { id: os.id }, body: { itemId: 'i1', quantity: 2 } } as unknown as Request;
    await controller.addItemToOS(req, makeRes(), jest.fn());
    expect(fns.addItem).toHaveBeenCalledWith(os.id, 'i1', 2);
  });
});
