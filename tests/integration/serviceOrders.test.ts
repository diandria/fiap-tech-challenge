import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../../src/app';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testSetup';
import { MongoUserRepository } from '../../src/infrastructure/persistence/repositories/MongoUserRepository';
import { RegisterUseCase } from '../../src/application/use-cases/auth/RegisterUseCase';

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
  const repo = new MongoUserRepository();
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

async function seedDomainData(): Promise<void> {
  const auth = { Authorization: `Bearer ${adminToken}` };

  const cust = await request(app).post('/customers').set(auth)
    .send({ name: 'João', taxId: '529.982.247-25', taxType: 'CPF', email: 'j@t.com', phone: '11999999999' });
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
  app = createApp();
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
    const statusCheck = await request(app).get(`/service-orders/${osId}/status`);
    expect(statusCheck.status).toBe(200);
    expect(statusCheck.body.status).toBe('WAITING_APPROVAL');
    expect(statusCheck.body.budgetTotal).toBe(130);

    // 7. Approve budget — public PATCH /budget with first 4 digits of CPF (52998224725 → "5299") → APPROVED
    const approve = await request(app).patch(`/service-orders/${osId}/budget`)
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

    // Public PATCH /budget with REJECTED + correct code
    const reject = await request(app).patch(`/service-orders/${osId}/budget`)
      .send({ status: 'REJECTED', code: '5299' });
    expect(reject.status).toBe(200);
    expect(reject.body.status).toBe('REJECTED');

    // Reservations released
    const afterReject = await request(app).get(`/items/${itemId}`).set(auth);
    expect(afterReject.body.reservedQuantity).toBe(0);
    expect(afterReject.body.availableQuantity).toBe(10);
  });

  it('GIVEN an OS in WAITING_APPROVAL WHEN PATCH /budget with status=APPROVED is called with a wrong code THEN returns 400', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const mechAuth = { Authorization: `Bearer ${mechanicToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;
    await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'DIAGNOSIS' });
    await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'WAITING_APPROVAL' });

    const res = await request(app).patch(`/service-orders/${osId}/budget`).send({ status: 'APPROVED', code: '0000' });
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

    const res = await request(app).patch(`/service-orders/${osId}/budget`).send({ status: 'EXECUTION', code: '5299' });
    expect(res.status).toBe(400);
  });

  it('GIVEN PATCH /budget without status in body THEN returns 400', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const created = await request(app).post('/service-orders').set(auth).send({ customerId, vehicleId });
    const osId = created.body.id;
    const res = await request(app).patch(`/service-orders/${osId}/budget`).send({ code: '5299' });
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

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const res = await request(app).patch(`/service-orders/${osId}`).set(mechAuth).send({ status: 'WAITING_APPROVAL' });
      expect(res.status).toBe(200);

      const notificationLog = logSpy.mock.calls
        .map((args) => String(args[0]))
        .find((line) => line.startsWith('[NOTIFICATION]'));
      expect(notificationLog).toBeDefined();
      expect(notificationLog).toContain('Email sent to j@t.com');
      expect(notificationLog).toContain(osId);
      expect(notificationLog).toContain('R$ 80');
    } finally {
      logSpy.mockRestore();
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
