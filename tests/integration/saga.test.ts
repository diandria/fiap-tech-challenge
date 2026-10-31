import request from 'supertest';
import { connectTestDB, disconnectTestDB, clearTestDB, createTestApp, prisma } from '../helpers/testSetup';
import { signCustomerToken } from '../helpers/customerToken';
import { PrismaUnitOfWork } from '../../src/adapters/gateways/PrismaUnitOfWork';
import { PostgresServiceRepository } from '../../src/adapters/gateways/PostgresServiceRepository';
import { PostgresCustomerRepository } from '../../src/adapters/gateways/PostgresCustomerRepository';
import { ServiceOrderSaga } from '../../src/use-cases/saga/ServiceOrderSaga';
import { sagaReply } from '../support/sagaReplies';

const noTrace = { currentTraceparent: () => undefined };
const silentLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

let saga: ServiceOrderSaga;

beforeAll(async () => {
  process.env.JWT_SECRET = 'saga-test-secret';
  await connectTestDB();
  saga = new ServiceOrderSaga(
    new PrismaUnitOfWork(prisma, noTrace),
    new PostgresServiceRepository(prisma),
    new PostgresCustomerRepository(prisma),
    { execute: jest.fn() },
    silentLogger,
  );
});
afterAll(async () => { await disconnectTestDB(); });
afterEach(async () => { await clearTestDB(); });

/** An order with one service at 120.00 and two reserved units of an item at 30.00, in the given status. */
async function seedOrder(
  status: 'DIAGNOSIS' | 'WAITING_APPROVAL' | 'APPROVED' | 'PAID' | 'EXECUTION' = 'DIAGNOSIS',
  stock: { stockQuantity: number; reservedQuantity: number; ordered: number } = { stockQuantity: 10, reservedQuantity: 2, ordered: 2 },
): Promise<{ orderId: string; customerId: string; serviceId: string; itemId: string }> {
  const customer = await prisma.customer.create({
    data: { name: 'Maria Souza', taxId: '52998224725', taxType: 'CPF', email: 'maria@example.com', phone: '11999999999' },
  });
  const vehicle = await prisma.vehicle.create({
    data: { customerId: customer.id, plate: 'ABC1D23', brand: 'Fiat', model: 'Uno', year: 2018 },
  });
  const service = await prisma.service.create({ data: { name: 'Oil change', price: 120, estimatedMinutes: 30 } });
  const item = await prisma.item.create({
    data: { name: 'Oil filter', price: 30, stockQuantity: stock.stockQuantity, reservedQuantity: stock.reservedQuantity },
  });
  const order = await prisma.serviceOrder.create({
    data: {
      customerId: customer.id,
      vehicleId: vehicle.id,
      status,
      services: { create: [{ serviceId: service.id }] },
      items: { create: [{ itemId: item.id, quantity: stock.ordered }] },
    },
  });
  return { orderId: order.id, customerId: customer.id, serviceId: service.id, itemId: item.id };
}

describe('Service order saga', () => {
  it('GIVEN an order in DIAGNOSIS with one service and one item WHEN DiagnosisCompleted is handled THEN the order is WAITING_APPROVAL and a GenerateBudget with both priced lines is in the outbox', async () => {
    // GIVEN
    const { orderId, serviceId, itemId } = await seedOrder();

    // WHEN
    const result = await saga.handle(sagaReply('DiagnosisCompleted', orderId));

    // THEN
    expect(result.outcome).toBe('applied');
    const order = await prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId }, include: { statusHistory: true } });
    expect(order.status).toBe('WAITING_APPROVAL');
    expect(order.statusHistory).toContainEqual(expect.objectContaining({ fromStatus: 'DIAGNOSIS', toStatus: 'WAITING_APPROVAL' }));

    const outbox = await prisma.outboxMessage.findMany();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      destination: 'billing-commands',
      type: 'GenerateBudget',
      serviceOrderId: orderId,
      payload: {
        customer: { name: 'Maria Souza', email: 'maria@example.com' },
        lines: [
          { kind: 'SERVICE', referenceId: serviceId, description: 'Oil change', unitPrice: 120, quantity: 1 },
          { kind: 'ITEM', referenceId: itemId, description: 'Oil filter', unitPrice: 30, quantity: 2 },
        ],
      },
    });
  });

  it('GIVEN DiagnosisCompleted already handled WHEN the same messageId arrives again THEN the outbox has a single GenerateBudget', async () => {
    // GIVEN
    const { orderId } = await seedOrder();
    const reply = sagaReply('DiagnosisCompleted', orderId);
    await saga.handle(reply);

    // WHEN
    const repeat = await saga.handle(reply);

    // THEN
    expect(repeat.outcome).toBe('duplicate');
    expect(await prisma.outboxMessage.count({ where: { type: 'GenerateBudget' } })).toBe(1);
  });

  it('GIVEN an order still RECEIVED WHEN DiagnosisCompleted arrives THEN it is ignored and nothing is written but the processed record', async () => {
    // GIVEN
    const { orderId } = await seedOrder();
    await prisma.serviceOrder.update({ where: { id: orderId }, data: { status: 'RECEIVED' } });

    // WHEN
    const result = await saga.handle(sagaReply('DiagnosisCompleted', orderId));

    // THEN
    expect(result.outcome).toBe('ignored');
    expect((await prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('RECEIVED');
    expect(await prisma.outboxMessage.count()).toBe(0);
    expect(await prisma.processedMessage.count()).toBe(1);
  });

  it('GIVEN an order WAITING_APPROVAL WHEN BudgetApproved is handled THEN the order is APPROVED and RequestPayment is in the outbox', async () => {
    // GIVEN
    const { orderId } = await seedOrder('WAITING_APPROVAL');

    // WHEN
    const result = await saga.handle(sagaReply('BudgetApproved', orderId, { budgetId: '33333333-3333-4333-8333-333333333333' }));

    // THEN
    expect(result.outcome).toBe('applied');
    expect((await prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('APPROVED');
    const outbox = await prisma.outboxMessage.findMany();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({ destination: 'billing-commands', type: 'RequestPayment', serviceOrderId: orderId });
  });

  it('GIVEN an order WAITING_APPROVAL WHEN a BudgetGenerated reply carrying 180.00 is handled THEN GET /service-orders/:id/status shows budgetTotal 180', async () => {
    // GIVEN
    const { orderId, customerId } = await seedOrder('WAITING_APPROVAL');

    // WHEN
    await saga.handle(sagaReply('BudgetGenerated', orderId, { budgetId: '33333333-3333-4333-8333-333333333333', total: 180 }));

    // THEN
    const res = await request(createTestApp())
      .get(`/service-orders/${orderId}/status`)
      .set('Authorization', `Bearer ${signCustomerToken(customerId)}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'WAITING_APPROVAL', budgetTotal: 180 });
  });

  it('GIVEN an order WAITING_APPROVAL with 2 units reserved WHEN BudgetRejected is handled THEN the order is REJECTED, reserved quantity drops by 2 and CancelExecution is in the outbox', async () => {
    // GIVEN
    const { orderId, itemId } = await seedOrder('WAITING_APPROVAL');

    // WHEN
    const result = await saga.handle(sagaReply('BudgetRejected', orderId, { budgetId: '33333333-3333-4333-8333-333333333333' }));

    // THEN
    expect(result).toMatchObject({ outcome: 'applied', compensation: 'BUDGET_REJECTED' });
    expect((await prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('REJECTED');
    expect(await prisma.item.findUniqueOrThrow({ where: { id: itemId } })).toMatchObject({ stockQuantity: 10, reservedQuantity: 0 });
    const outbox = await prisma.outboxMessage.findMany();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      destination: 'execution-commands',
      type: 'CancelExecution',
      serviceOrderId: orderId,
      payload: { reason: 'BUDGET_REJECTED' },
    });
  });

  it('GIVEN a reservation smaller than the order WHEN BudgetRejected is handled THEN it fails and nothing changes', async () => {
    // GIVEN
    const { orderId, itemId } = await seedOrder('WAITING_APPROVAL');
    await prisma.item.update({ where: { id: itemId }, data: { reservedQuantity: 1 } });

    // WHEN
    const handling = saga.handle(sagaReply('BudgetRejected', orderId, { budgetId: '33333333-3333-4333-8333-333333333333' }));

    // THEN
    await expect(handling).rejects.toThrow('Cannot release');
    expect((await prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('WAITING_APPROVAL');
    expect((await prisma.item.findUniqueOrThrow({ where: { id: itemId } })).reservedQuantity).toBe(1);
    expect(await prisma.outboxMessage.count()).toBe(0);
    expect(await prisma.processedMessage.count()).toBe(0);
  });

  it('GIVEN an APPROVED order with 1 unit reserved out of 5 in stock WHEN PaymentConfirmed is handled THEN the order is PAID, stock is 4 with 0 reserved and EnqueueRepair is in the outbox', async () => {
    // GIVEN
    const { orderId, itemId, serviceId } = await seedOrder('APPROVED', { stockQuantity: 5, reservedQuantity: 1, ordered: 1 });

    // WHEN
    const result = await saga.handle(sagaReply('PaymentConfirmed', orderId, { paymentId: '44444444-4444-4444-8444-444444444444', amount: 150 }));

    // THEN
    expect(result.outcome).toBe('applied');
    expect((await prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PAID');
    expect(await prisma.item.findUniqueOrThrow({ where: { id: itemId } })).toMatchObject({ stockQuantity: 4, reservedQuantity: 0 });
    const outbox = await prisma.outboxMessage.findMany();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      destination: 'execution-commands',
      type: 'EnqueueRepair',
      serviceOrderId: orderId,
      payload: { tasks: [{ serviceId, name: 'Oil change' }] },
    });
  });

  it('GIVEN an APPROVED order with 1 unit reserved WHEN PaymentFailed is handled THEN the order is CANCELLED, the reservation is released and both CancelExecution and CancelBudget are in the outbox', async () => {
    // GIVEN
    const { orderId, itemId } = await seedOrder('APPROVED', { stockQuantity: 5, reservedQuantity: 1, ordered: 1 });

    // WHEN
    const result = await saga.handle(sagaReply('PaymentFailed', orderId, { paymentId: '44444444-4444-4444-8444-444444444444', reason: 'cc_rejected_other_reason' }));

    // THEN
    expect(result).toMatchObject({ outcome: 'applied', compensation: 'PAYMENT_FAILED' });
    expect((await prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('CANCELLED');
    expect(await prisma.item.findUniqueOrThrow({ where: { id: itemId } })).toMatchObject({ stockQuantity: 5, reservedQuantity: 0 });
    const outbox = await prisma.outboxMessage.findMany({ orderBy: { destination: 'asc' } });
    expect(outbox.map((message) => [message.destination, message.type, message.payload])).toEqual([
      ['billing-commands', 'CancelBudget', { reason: 'PAYMENT_FAILED' }],
      ['execution-commands', 'CancelExecution', { reason: 'PAYMENT_FAILED' }],
    ]);
  });

  it('GIVEN a PAID order WHEN RepairStarted is handled THEN the order is EXECUTION with startedAt set', async () => {
    // GIVEN
    const { orderId } = await seedOrder('PAID', { stockQuantity: 4, reservedQuantity: 0, ordered: 1 });

    // WHEN
    const result = await saga.handle(sagaReply('RepairStarted', orderId));

    // THEN
    expect(result.outcome).toBe('applied');
    const order = await prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('EXECUTION');
    expect(order.startedAt).toBeInstanceOf(Date);
  });

  it('GIVEN an order in EXECUTION WHEN RepairCompleted is handled THEN the order is FINISHED and the history ends with FINISHED', async () => {
    // GIVEN
    const { orderId } = await seedOrder('EXECUTION', { stockQuantity: 4, reservedQuantity: 0, ordered: 1 });

    // WHEN
    const result = await saga.handle(sagaReply('RepairCompleted', orderId));

    // THEN
    expect(result.outcome).toBe('applied');
    const order = await prisma.serviceOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { statusHistory: { orderBy: { changedAt: 'asc' } } },
    });
    expect(order.status).toBe('FINISHED');
    expect(order.finishedAt).toBeInstanceOf(Date);
    expect(order.statusHistory.at(-1)).toMatchObject({ fromStatus: 'EXECUTION', toStatus: 'FINISHED' });
  });

  it('GIVEN an order rejected by the customer WHEN ExecutionCancelled is handled THEN nothing changes but the message is recorded', async () => {
    // GIVEN
    const { orderId } = await seedOrder('WAITING_APPROVAL');
    await saga.handle(sagaReply('BudgetRejected', orderId, { budgetId: '33333333-3333-4333-8333-333333333333' }));
    const before = await prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } });

    // WHEN
    const result = await saga.handle(sagaReply('ExecutionCancelled', orderId));

    // THEN
    expect(result.outcome).toBe('applied');
    expect(await prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: 'REJECTED', version: before.version });
    expect(await prisma.outboxMessage.count()).toBe(1);
    expect(await prisma.processedMessage.count()).toBe(2);
  });
});
