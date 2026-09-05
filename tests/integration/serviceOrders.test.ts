import request from 'supertest';
import { logger } from '../../src/frameworks/logging/logger';
import { Application } from 'express';

import { connectTestDB, disconnectTestDB, clearTestDB, createTestApp, prisma } from '../helpers/testSetup';
import { PostgresUserRepository } from '../../src/adapters/gateways/PostgresUserRepository';
import { RegisterUseCase } from '../../src/use-cases/auth/RegisterUseCase';
import { serviceOrdersCreated } from '../../src/frameworks/metrics/businessMetrics';
import jwt from 'jsonwebtoken';

let app: Application;
let adminToken: string;
let mechanicToken: string;
let attendantToken: string;

let customerId: string;
let vehicleId: string;
let serviceId: string;
let itemId: string;

// Tokens are obtained once — auth middleware is stateless (JWT), so tokens remain
// valid across afterEach DB clears for the lifetime of the test run.
async function seedTokens(): Promise<void> {
  const repo = new PostgresUserRepository(prisma);
  const register = new RegisterUseCase(repo);
  await register.execute({ email: 'admin@test.com', password: 'adminpass', role: 'admin' });
  await register.execute({ email: 'mechanic@test.com', password: 'mechpass', role: 'mechanic' });
  await register.execute({ email: 'attendant@test.com', password: 'attpass', role: 'attendant' });
  const adminRes = await request(app).post('/auth/login').send({ email: 'admin@test.com', password: 'adminpass' });
  adminToken = adminRes.body.token;
  const mechRes = await request(app).post('/auth/login').send({ email: 'mechanic@test.com', password: 'mechpass' });
  mechanicToken = mechRes.body.token;
  const attRes = await request(app).post('/auth/login').send({ email: 'attendant@test.com', password: 'attpass' });
  attendantToken = attRes.body.token;
}

/**
 * Issues a customer token in the same shape the function issues (RFC-003).
 * Signed with the application's secret, which is the same on both sides.
 */
function customerToken(id: string, cpf = '52998224725'): string {
  return jwt.sign(
    { type: 'customer', sub: id, cpf, name: 'John' },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' },
  );
}

async function seedDomainData(): Promise<void> {
  const auth = { Authorization: `Bearer ${adminToken}` };

  const cust = await request(app).post('/customers').set(auth)
    .send({ name: 'John', taxId: '529.982.247-25', taxType: 'CPF', email: 'j@t.com', phone: '11999999999' });
  customerId = cust.body.id;

  const veh = await request(app).post('/vehicles').set(auth)
    .send({ customerId, plate: 'ABC-1234', brand: 'Toyota', model: 'Corolla', year: 2020 });
  vehicleId = veh.body.id;

  const svc = await request(app).post('/services').set(auth)
    .send({ name: 'Oil Change', price: 80, estimatedMinutes: 30 });
  serviceId = svc.body.id;

  const itm = await request(app).post('/items').set(auth)
    .send({ name: 'Oil Filter', price: 25, stockQuantity: 10 });
  itemId = itm.body.id;
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret';
  await connectTestDB();
  app = createTestApp();
  await seedTokens();
});

afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearTestDB(); });
beforeEach(async () => { await seedDomainData(); });

describe('Full OS lifecycle', () => {
  it('GIVEN a full set of prerequisites WHEN the OS walks from RECEIVED to DELIVERED THEN every transition returns the expected status', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };

    // 1. Create OS → RECEIVED (attendant/admin)
    const created = await request(app).post('/service-orders').set(auth)
      .send({ customerId, vehicleId });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('RECEIVED');
    const osId = created.body.id;

    // 2. Mechanic starts diagnosis → DIAGNOSIS
    const diag = await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'DIAGNOSIS' });
    expect(diag.status).toBe(200);
    expect(diag.body.status).toBe('DIAGNOSIS');

    // 3. Add service
    const addSvc = await request(app).post(`/service-orders/${osId}/services`).set(mechAuth)
      .send({ serviceId });
    expect(addSvc.status).toBe(200);
    expect(addSvc.body.services).toHaveLength(1);

    // 4. Add item (reserves 2 units)
    const addItm = await request(app).post(`/service-orders/${osId}/items`).set(mechAuth)
      .send({ itemId, quantity: 2 });
    expect(addItm.status).toBe(200);
    expect(addItm.body.items).toHaveLength(1);

    // Stock reserved: 8 available (10 total - 2 reserved)
    const itemAfterReserve = await request(app).get(`/items/${itemId}`).set(auth);
    expect(itemAfterReserve.body.reservedQuantity).toBe(2);
    expect(itemAfterReserve.body.availableQuantity).toBe(8);

    // 5. Mechanic finishes diagnosis → WAITING_APPROVAL with budgetTotal = 80 + (25*2) = 130
    const finish = await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'WAITING_APPROVAL' });
    expect(finish.status).toBe(200);
    expect(finish.body.status).toBe('WAITING_APPROVAL');
    expect(finish.body.budgetTotal).toBe(130);

    // 6. Public status check (no auth)
    const statusCheck = await request(app).get(`/service-orders/${osId}/status`)
      .set('Authorization', `Bearer ${customerToken(customerId)}`);
    expect(statusCheck.status).toBe(200);
    expect(statusCheck.body.status).toBe('WAITING_APPROVAL');
    expect(statusCheck.body.budgetTotal).toBe(130);

    // 7. Approve budget — customer PATCH /budget with first 4 digits of CPF (52998224725 → "5299") → APPROVED
    const approve = await request(app).patch(`/service-orders/${osId}/budget`)
      .set('Authorization', `Bearer ${customerToken(customerId)}`)
      .send({ status: 'APPROVED', code: '5299' });
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('APPROVED');

    // Stock still reserved at this point — not yet consumed
    const itemAfterApprove = await request(app).get(`/items/${itemId}`).set(auth);
    expect(itemAfterApprove.body.stockQuantity).toBe(10);
    expect(itemAfterApprove.body.reservedQuantity).toBe(2);

    // 8. Mechanic starts execution → EXECUTION, stock consumed
    const startExec = await request(app).patch(`/service-orders/${osId}`)
      .set(mechAuth).send({ status: 'EXECUTION' });
    expect(startExec.status).toBe(200);
    expect(startExec.body.status).toBe('EXECUTION');
    expect(startExec.body.startedAt).toBeDefined();

    // Stock consumed: stockQuantity 10-2=8, reservedQuantity 2-2=0
    const itemAfterExec = await request(app).get(`/items/${itemId}`).set(auth);
    expect(itemAfterExec.body.stockQuantity).toBe(8);
    expect(itemAfterExec.body.reservedQuantity).toBe(0);
    expect(itemAfterExec.body.availableQuantity).toBe(8);

    // 9. Start service (per-service tracking) — body-driven IN_PROGRESS
    const startSvc = await request(app)
      .patch(`/service-orders/${osId}/services/${serviceId}`)
      .set(mechAuth).send({ status: 'IN_PROGRESS' });
    expect(startSvc.status).toBe(200);
    expect(startSvc.body.services[0].startedAt).toBeDefined();

    // 10. Finish service — body-driven COMPLETED
    const finishSvc = await request(app)
      .patch(`/service-orders/${osId}/services/${serviceId}`)
      .set(mechAuth).send({ status: 'COMPLETED' });
    expect(finishSvc.status).toBe(200);
    expect(finishSvc.body.services[0].finishedAt).toBeDefined();

    // 11. Finish OS → FINISHED
    const finishOS = await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'FINISHED' });
    expect(finishOS.status).toBe(200);
    expect(finishOS.body.status).toBe('FINISHED');
    expect(finishOS.body.finishedAt).toBeDefined();

    // 12. Deliver OS → DELIVERED
    const deliver = await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'DELIVERED' });
    expect(deliver.status).toBe(200);
    expect(deliver.body.status).toBe('DELIVERED');
    expect(deliver.body.deliveredAt).toBeDefined();
  });

  it('GIVEN an OS in WAITING_APPROVAL with reserved stock WHEN PATCH status=REJECTED is called THEN status becomes REJECTED AND item reservations are released', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };

    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;

    await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'DIAGNOSIS' });
    await request(app).post(`/service-orders/${osId}/items`).set(mechAuth).send({ itemId, quantity: 3 });
    await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'WAITING_APPROVAL' });

    const beforeReject = await request(app).get(`/items/${itemId}`).set(auth);
    expect(beforeReject.body.reservedQuantity).toBe(3);

    // Customer PATCH /budget with REJECTED + correct code
    const reject = await request(app).patch(`/service-orders/${osId}/budget`)
      .set('Authorization', `Bearer ${customerToken(customerId)}`)
      .send({ status: 'REJECTED', code: '5299' });
    expect(reject.status).toBe(200);
    expect(reject.body.status).toBe('REJECTED');

    // Reservations released
    const afterReject = await request(app).get(`/items/${itemId}`).set(auth);
    expect(afterReject.body.reservedQuantity).toBe(0);
    expect(afterReject.body.availableQuantity).toBe(10);
  });

  describe('Customer authentication on the two customer routes', () => {
    async function osWaitingApproval(): Promise<string> {
      const auth = { Authorization: `Bearer ${adminToken}` };
      const os = await request(app).post('/service-orders').set(auth)
        .send({ customerId, vehicleId, serviceIds: [serviceId], items: [{ itemId, quantity: 1 }] });
      const osId = os.body.id;
      await request(app).patch(`/service-orders/${osId}`).set({ Authorization: `Bearer ${mechanicToken}` })
        .send({ status: 'DIAGNOSIS' });
      await request(app).patch(`/service-orders/${osId}`).set({ Authorization: `Bearer ${mechanicToken}` })
        .send({ status: 'WAITING_APPROVAL' });
      return osId;
    }

    it('GIVEN no token WHEN GET /service-orders/:id/status THEN returns 401', async () => {
      const osId = await osWaitingApproval();
      const res = await request(app).get(`/service-orders/${osId}/status`);
      expect(res.status).toBe(401);
    });

    it('GIVEN the owner customer token WHEN GET /service-orders/:id/status THEN returns 200', async () => {
      const osId = await osWaitingApproval();
      const res = await request(app).get(`/service-orders/${osId}/status`)
        .set('Authorization', `Bearer ${customerToken(customerId)}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('WAITING_APPROVAL');
    });

    it('GIVEN another customer token WHEN GET /service-orders/:id/status THEN returns 403', async () => {
      const osId = await osWaitingApproval();
      const res = await request(app).get(`/service-orders/${osId}/status`)
        .set('Authorization', `Bearer ${customerToken('00000000-0000-0000-0000-000000000000')}`);
      expect(res.status).toBe(403);
    });

    // An employee token does not pass either: with no `sub` there is no owner
    // to compare against.
    it('GIVEN a staff token WHEN GET /service-orders/:id/status THEN returns 403', async () => {
      const osId = await osWaitingApproval();
      const res = await request(app).get(`/service-orders/${osId}/status`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(403);
    });

    it('GIVEN no token WHEN PATCH /service-orders/:id/budget THEN returns 401', async () => {
      const osId = await osWaitingApproval();
      const res = await request(app).patch(`/service-orders/${osId}/budget`)
        .send({ status: 'APPROVED', code: '5299' });
      expect(res.status).toBe(401);
    });

    // A 403 is not enough: the status must not change.
    it('GIVEN another customer token WHEN PATCH /budget THEN returns 403 AND keeps the status', async () => {
      const osId = await osWaitingApproval();

      const res = await request(app).patch(`/service-orders/${osId}/budget`)
        .set('Authorization', `Bearer ${customerToken('00000000-0000-0000-0000-000000000000')}`)
        .send({ status: 'APPROVED', code: '5299' });

      expect(res.status).toBe(403);

      const after = await request(app).get(`/service-orders/${osId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(after.body.status).toBe('WAITING_APPROVAL');
    });
  });

  it('GIVEN an OS in WAITING_APPROVAL WHEN PATCH /budget with status=APPROVED is called with a wrong code THEN returns 400', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;
    await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'DIAGNOSIS' });
    await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'WAITING_APPROVAL' });

    const res = await request(app).patch(`/service-orders/${osId}/budget`).set('Authorization', `Bearer ${customerToken(customerId)}`).send({ status: 'APPROVED', code: '0000' });
    expect(res.status).toBe(400);
  });

  it('GIVEN PATCH /:id with status=APPROVED THEN returns 400 (budget transitions live on /budget)', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;
    await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'DIAGNOSIS' });
    await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'WAITING_APPROVAL' });

    const res = await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'APPROVED', code: '5299' });
    expect(res.status).toBe(400);
  });

  it('GIVEN PATCH /budget with unsupported status THEN returns 400', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;
    await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'DIAGNOSIS' });
    await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'WAITING_APPROVAL' });

    const res = await request(app).patch(`/service-orders/${osId}/budget`).set('Authorization', `Bearer ${customerToken(customerId)}`).send({ status: 'EXECUTION', code: '5299' });
    expect(res.status).toBe(400);
  });

  it('GIVEN PATCH /budget without status in body THEN returns 400', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;
    const res = await request(app).patch(`/service-orders/${osId}/budget`).set('Authorization', `Bearer ${customerToken(customerId)}`).send({ code: '5299' });
    expect(res.status).toBe(400);
  });

  it('GIVEN an OS in RECEIVED status WHEN PATCH status=WAITING_APPROVAL is called directly THEN returns 400 for invalid transition', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;
    const res = await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'WAITING_APPROVAL' });
    expect(res.status).toBe(400);
  });

  it('GIVEN a mechanic token WHEN POST /service-orders THEN returns 403', async () => {
    const res = await request(app)
      .post('/service-orders')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({ customerId, vehicleId });
    expect(res.status).toBe(403);
  });

  it('GIVEN an attendant token WHEN PATCH status=DIAGNOSIS THEN returns 403 (only mechanic+admin)', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;
    const res = await request(app)
      .patch(`/service-orders/${osId}`)
      .set('Authorization', `Bearer ${attendantToken}`)
      .send({ status: 'DIAGNOSIS' });
    expect(res.status).toBe(403);
  });

  it('GIVEN no token WHEN PATCH status=DIAGNOSIS THEN returns 401', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;
    const res = await request(app).patch(`/service-orders/${osId}`).send({ status: 'DIAGNOSIS' });
    expect(res.status).toBe(401);
  });

  it('GIVEN PATCH with no status in body THEN returns 400', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const res = await request(app).patch(`/service-orders/${created.body.id}`).set(mechAuth).send({});
    expect(res.status).toBe(400);
  });

  it('GIVEN PATCH with unsupported status THEN returns 400', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const res = await request(app).patch(`/service-orders/${created.body.id}`).set(mechAuth).send({ status: 'RECEIVED' });
    expect(res.status).toBe(400);
  });

  it('GIVEN PATCH service status without status in body THEN returns 400', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;
    await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'DIAGNOSIS' });
    await request(app).post(`/service-orders/${osId}/services`).set(mechAuth).send({ serviceId });
    const res = await request(app).patch(`/service-orders/${osId}/services/${serviceId}`).set(mechAuth).send({});
    expect(res.status).toBe(400);
  });

  it('GIVEN PATCH service status with unsupported value THEN returns 400', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;
    await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'DIAGNOSIS' });
    await request(app).post(`/service-orders/${osId}/services`).set(mechAuth).send({ serviceId });
    const res = await request(app)
      .patch(`/service-orders/${osId}/services/${serviceId}`)
      .set(mechAuth)
      .send({ status: 'WHATEVER' });
    expect(res.status).toBe(400);
  });

  it('GIVEN an OS in DIAGNOSIS WHEN PATCH status=WAITING_APPROVAL is called THEN the customer notification mock is logged with email and OS id', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };

    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;
    await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'DIAGNOSIS' });
    await request(app).post(`/service-orders/${osId}/services`).set(mechAuth).send({ serviceId });

    // The notification emits a structured event, so this checks fields.
    const emitted: Record<string, unknown>[] = [];
    const infoSpy = jest
      .spyOn(logger, 'info')
      .mockImplementation(((payload: Record<string, unknown>) => {
        emitted.push(payload);
        return undefined;
      }) as never);

    try {
      const res = await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'WAITING_APPROVAL' });
      expect(res.status).toBe(200);

      const budgetEvent = emitted.find((e) => e.event === 'budget_ready');
      expect(budgetEvent).toBeDefined();
      expect(budgetEvent?.osId).toBe(osId);
      expect(budgetEvent?.budgetTotal).toBe(80);
      expect(budgetEvent?.customerEmail).toBe('j@t.com');
    } finally {
      infoSpy.mockRestore();
    }
  });

  it('GIVEN two OS created WHEN one is moved to DIAGNOSIS THEN GET ?status=DIAGNOSIS returns only that one', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const os1 = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    await request(app).patch(`/service-orders/${os1.body.id}`).set(mechAuth).send({ status: 'DIAGNOSIS' });

    const res = await request(app).get('/service-orders?status=DIAGNOSIS').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].status).toBe('DIAGNOSIS');
  });
});

describe('POST /service-orders — creation with services and items', () => {
  it('GIVEN no services or items WHEN creating an OS THEN returns 201 with RECEIVED status and empty arrays', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const res = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('RECEIVED');
    expect(res.body.services).toEqual([]);
    expect(res.body.items).toEqual([]);
  });

  // Covers the wiring in main.ts; the decorator's unit tests use a double
  // and would not catch a wrong composition.
  it('GIVEN a successful creation WHEN POST /service-orders THEN increments the business counter', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const before = (await serviceOrdersCreated.get()).values[0].value;

    const res = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });

    expect(res.status).toBe(201);
    const after = (await serviceOrdersCreated.get()).values[0].value;
    expect(after).toBe(before + 1);
  });

  it('GIVEN a valid serviceId WHEN creating an OS with services array THEN returns 201 with service resolved in body', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const res = await request(app).post('/service-orders').set(auth)
      .send({ customerId, vehicleId, services: [serviceId] });

    expect(res.status).toBe(201);
    expect(res.body.services).toHaveLength(1);
    expect(res.body.services[0].serviceId).toBe(serviceId);
    expect(res.body.items).toEqual([]);
  });

  it('GIVEN a valid itemId with sufficient stock WHEN creating an OS with items array THEN returns 201 and stock is reserved immediately', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const res = await request(app).post('/service-orders').set(auth)
      .send({ customerId, vehicleId, items: [{ itemId, quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].itemId).toBe(itemId);

    const itemAfter = await request(app).get(`/items/${itemId}`).set(auth);
    expect(itemAfter.body.reservedQuantity).toBe(2);
    expect(itemAfter.body.stockQuantity).toBe(10);
  });

  it('GIVEN a non-existent serviceId WHEN creating an OS THEN returns 404 and OS is not created', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const res = await request(app).post('/service-orders').set(auth)
      .send({ customerId, vehicleId, services: ['non-existent-id'] });

    expect(res.status).toBe(404);
  });

  it('GIVEN a non-existent itemId WHEN creating an OS THEN returns 404 and OS is not created', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const res = await request(app).post('/service-orders').set(auth)
      .send({ customerId, vehicleId, items: [{ itemId: 'non-existent-id', quantity: 1 }] });

    expect(res.status).toBe(404);
  });

  it('GIVEN a requested quantity greater than available stock WHEN creating an OS THEN returns 400', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const res = await request(app).post('/service-orders').set(auth)
      .send({ customerId, vehicleId, items: [{ itemId, quantity: 999 }] });

    expect(res.status).toBe(400);
  });

  it('GIVEN first item valid and second item with no stock WHEN creating an OS THEN returns 400 and first item reservedQuantity is not increased', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };

    const depletedRes = await request(app).post('/items').set(auth)
      .send({ name: 'Depleted Part', price: 10, stockQuantity: 0 });
    const depletedItemId = depletedRes.body.id;

    const itemBefore = await request(app).get(`/items/${itemId}`).set(auth);
    const reservedBefore = itemBefore.body.reservedQuantity;

    const res = await request(app).post('/service-orders').set(auth).send({
      customerId,
      vehicleId,
      items: [
        { itemId, quantity: 2 },
        { itemId: depletedItemId, quantity: 1 },
      ],
    });

    expect(res.status).toBe(400);

    const itemAfter = await request(app).get(`/items/${itemId}`).set(auth);
    expect(itemAfter.body.reservedQuantity).toBe(reservedBefore);
  });
});

describe('DELETE /service-orders/:id/services/:serviceId — diagnosis refinement', () => {
  async function createOSInDiagnosisWithService(): Promise<{ osId: string }> {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;
    await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'DIAGNOSIS' });
    await request(app).post(`/service-orders/${osId}/services`).set(mechAuth).send({ serviceId });
    return { osId };
  }

  it('GIVEN an OS in DIAGNOSIS with a service WHEN mechanic deletes the service THEN returns 200 with service absent from body', async () => {
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const { osId } = await createOSInDiagnosisWithService();

    const res = await request(app).delete(`/service-orders/${osId}/services/${serviceId}`).set(mechAuth);

    expect(res.status).toBe(200);
    expect(res.body.services).toHaveLength(0);
  });

  it('GIVEN an OS in RECEIVED status WHEN trying to delete a service THEN returns 400', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;

    const res = await request(app).delete(`/service-orders/${osId}/services/${serviceId}`).set(mechAuth);

    expect(res.status).toBe(400);
  });

  it('GIVEN an OS in DIAGNOSIS WHEN deleting a service not present in the OS THEN returns 404', async () => {
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const { osId } = await createOSInDiagnosisWithService();

    const res = await request(app).delete(`/service-orders/${osId}/services/non-existent-id`).set(mechAuth);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /service-orders/:id/items/:itemId — diagnosis refinement', () => {
  async function createOSInDiagnosisWithItem(): Promise<{ osId: string }> {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;
    await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'DIAGNOSIS' });
    await request(app).post(`/service-orders/${osId}/items`).set(mechAuth).send({ itemId, quantity: 2 });
    return { osId };
  }

  it('GIVEN an OS in DIAGNOSIS with an item WHEN mechanic deletes the item THEN returns 200 with item absent and reserved stock released', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const { osId } = await createOSInDiagnosisWithItem();

    const itemBefore = await request(app).get(`/items/${itemId}`).set(auth);
    expect(itemBefore.body.reservedQuantity).toBe(2);

    const res = await request(app).delete(`/service-orders/${osId}/items/${itemId}`).set(mechAuth);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);

    const itemAfter = await request(app).get(`/items/${itemId}`).set(auth);
    expect(itemAfter.body.reservedQuantity).toBe(0);
  });

  it('GIVEN an OS in RECEIVED status WHEN trying to delete an item THEN returns 400', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;

    const res = await request(app).delete(`/service-orders/${osId}/items/${itemId}`).set(mechAuth);

    expect(res.status).toBe(400);
  });

  it('GIVEN an OS in DIAGNOSIS WHEN deleting an item not present in the OS THEN returns 404', async () => {
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const { osId } = await createOSInDiagnosisWithItem();

    const res = await request(app).delete(`/service-orders/${osId}/items/non-existent-id`).set(mechAuth);

    expect(res.status).toBe(404);
  });
});

describe('GET /service-orders — active listing and priority sort', () => {
  const attAuth = () => ({ Authorization: `Bearer ${attendantToken}` });
  const mechAuth = () => ({ Authorization: `Bearer ${mechanicToken}` });
  const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });

  async function createOS(): Promise<string> {
    const res = await request(app)
      .post('/service-orders')
      .set(attAuth())
      .send({ customerId, vehicleId });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  async function advanceToStatus(
    osId: string,
    targetStatus: 'DIAGNOSIS' | 'WAITING_APPROVAL' | 'EXECUTION' | 'FINISHED' | 'DELIVERED',
  ): Promise<void> {
    expect((await request(app).patch(`/service-orders/${osId}`).set(mechAuth()).send({ status: 'DIAGNOSIS' })).status).toBe(200);
    if (targetStatus === 'DIAGNOSIS') return;

    expect((await request(app).patch(`/service-orders/${osId}`).set(mechAuth()).send({ status: 'WAITING_APPROVAL' })).status).toBe(200);
    if (targetStatus === 'WAITING_APPROVAL') return;

    expect((await request(app).patch(`/service-orders/${osId}/budget`).set('Authorization', `Bearer ${customerToken(customerId)}`).send({ status: 'APPROVED', code: '5299' })).status).toBe(200);

    expect((await request(app).patch(`/service-orders/${osId}`).set(mechAuth()).send({ status: 'EXECUTION' })).status).toBe(200);
    if (targetStatus === 'EXECUTION') return;

    expect((await request(app).patch(`/service-orders/${osId}`).set(mechAuth()).send({ status: 'FINISHED' })).status).toBe(200);
    if (targetStatus === 'FINISHED') return;

    expect((await request(app).patch(`/service-orders/${osId}`).set(mechAuth()).send({ status: 'DELIVERED' })).status).toBe(200);
  }

  it('GIVEN OS in RECEIVED, DIAGNOSIS, WAITING_APPROVAL, EXECUTION WHEN GET /service-orders THEN all four appear in result', async () => {
    const ids = await Promise.all([createOS(), createOS(), createOS(), createOS()]);
    await advanceToStatus(ids[1], 'DIAGNOSIS');
    await advanceToStatus(ids[2], 'WAITING_APPROVAL');
    await advanceToStatus(ids[3], 'EXECUTION');

    const res = await request(app).get('/service-orders').set(adminAuth());

    expect(res.status).toBe(200);
    const returnedIds = res.body.map((o: any) => o.id);
    expect(returnedIds).toContain(ids[0]);
    expect(returnedIds).toContain(ids[1]);
    expect(returnedIds).toContain(ids[2]);
    expect(returnedIds).toContain(ids[3]);
  });

  it('GIVEN OS in FINISHED WHEN GET /service-orders without filter THEN it does not appear in result', async () => {
    const osId = await createOS();
    await advanceToStatus(osId, 'FINISHED');

    const res = await request(app).get('/service-orders').set(adminAuth());

    expect(res.status).toBe(200);
    const returnedIds = res.body.map((o: any) => o.id);
    expect(returnedIds).not.toContain(osId);
  });

  it('GIVEN OS in DELIVERED WHEN GET /service-orders without filter THEN it does not appear in result', async () => {
    const osId = await createOS();
    await advanceToStatus(osId, 'DELIVERED');

    const res = await request(app).get('/service-orders').set(adminAuth());

    expect(res.status).toBe(200);
    const returnedIds = res.body.map((o: any) => o.id);
    expect(returnedIds).not.toContain(osId);
  });

  it('GIVEN OS in FINISHED WHEN GET /service-orders?status=FINISHED THEN it appears in result', async () => {
    const osId = await createOS();
    await advanceToStatus(osId, 'FINISHED');

    const res = await request(app).get('/service-orders?status=FINISHED').set(adminAuth());

    expect(res.status).toBe(200);
    const returnedIds = res.body.map((o: any) => o.id);
    expect(returnedIds).toContain(osId);
  });

  it('GIVEN OS in EXECUTION, WAITING_APPROVAL, DIAGNOSIS, RECEIVED WHEN GET /service-orders THEN result ordered by priority', async () => {
    const idReceived = await createOS();
    const idDiagnosis = await createOS();
    const idWaiting = await createOS();
    const idExecution = await createOS();

    await advanceToStatus(idDiagnosis, 'DIAGNOSIS');
    await advanceToStatus(idWaiting, 'WAITING_APPROVAL');
    await advanceToStatus(idExecution, 'EXECUTION');

    const res = await request(app).get('/service-orders').set(adminAuth());

    expect(res.status).toBe(200);
    const statuses: string[] = res.body.map((o: any) => o.status);

    const posExecution = statuses.indexOf('EXECUTION');
    const posWaiting = statuses.indexOf('WAITING_APPROVAL');
    const posDiagnosis = statuses.indexOf('DIAGNOSIS');
    const posReceived = statuses.indexOf('RECEIVED');

    expect(posExecution).toBeGreaterThanOrEqual(0);
    expect(posWaiting).toBeGreaterThanOrEqual(0);
    expect(posDiagnosis).toBeGreaterThanOrEqual(0);
    expect(posReceived).toBeGreaterThanOrEqual(0);
    expect(posExecution).toBeLessThan(posWaiting);
    expect(posWaiting).toBeLessThan(posDiagnosis);
    expect(posDiagnosis).toBeLessThan(posReceived);
  });

  it('GIVEN two OS in same status WHEN GET /service-orders THEN older createdAt comes first', async () => {
    const osFirst = await createOS();
    await new Promise((r) => setTimeout(r, 50));
    const osSecond = await createOS();

    const res = await request(app).get('/service-orders').set(adminAuth());

    expect(res.status).toBe(200);
    const returnedIds: string[] = res.body.map((o: any) => o.id);
    const posFirst = returnedIds.indexOf(osFirst);
    const posSecond = returnedIds.indexOf(osSecond);

    expect(posFirst).toBeGreaterThanOrEqual(0);
    expect(posSecond).toBeGreaterThanOrEqual(0);
    expect(posFirst).toBeLessThan(posSecond);
  });
});
