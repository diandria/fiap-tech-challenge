import { connectTestDB, disconnectTestDB, clearTestDB, prisma } from '../helpers/testSetup';
import { PrismaUnitOfWork } from '../../src/adapters/gateways/PrismaUnitOfWork';
import { PostgresServiceRepository } from '../../src/adapters/gateways/PostgresServiceRepository';
import { PostgresCustomerRepository } from '../../src/adapters/gateways/PostgresCustomerRepository';
import { ServiceOrderSaga } from '../../src/use-cases/saga/ServiceOrderSaga';
import { sagaReply } from '../support/sagaReplies';

const noTrace = { currentTraceparent: () => undefined };
const silentLogger = { warn: jest.fn(), error: jest.fn() };

let saga: ServiceOrderSaga;

beforeAll(async () => {
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

/** An order in DIAGNOSIS with one service at 120.00 and two units of an item at 30.00. */
async function seedOrderInDiagnosis(): Promise<{ orderId: string; serviceId: string; itemId: string }> {
  const customer = await prisma.customer.create({
    data: { name: 'Maria Souza', taxId: '52998224725', taxType: 'CPF', email: 'maria@example.com', phone: '11999999999' },
  });
  const vehicle = await prisma.vehicle.create({
    data: { customerId: customer.id, plate: 'ABC1D23', brand: 'Fiat', model: 'Uno', year: 2018 },
  });
  const service = await prisma.service.create({ data: { name: 'Oil change', price: 120, estimatedMinutes: 30 } });
  const item = await prisma.item.create({ data: { name: 'Oil filter', price: 30, stockQuantity: 10, reservedQuantity: 2 } });
  const order = await prisma.serviceOrder.create({
    data: {
      customerId: customer.id,
      vehicleId: vehicle.id,
      status: 'DIAGNOSIS',
      services: { create: [{ serviceId: service.id }] },
      items: { create: [{ itemId: item.id, quantity: 2 }] },
    },
  });
  return { orderId: order.id, serviceId: service.id, itemId: item.id };
}

describe('Service order saga', () => {
  it('GIVEN an order in DIAGNOSIS with one service and one item WHEN DiagnosisCompleted is handled THEN the order is WAITING_APPROVAL and a GenerateBudget with both priced lines is in the outbox', async () => {
    // GIVEN
    const { orderId, serviceId, itemId } = await seedOrderInDiagnosis();

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
    const { orderId } = await seedOrderInDiagnosis();
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
    const { orderId } = await seedOrderInDiagnosis();
    await prisma.serviceOrder.update({ where: { id: orderId }, data: { status: 'RECEIVED' } });

    // WHEN
    const result = await saga.handle(sagaReply('DiagnosisCompleted', orderId));

    // THEN
    expect(result.outcome).toBe('ignored');
    expect((await prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('RECEIVED');
    expect(await prisma.outboxMessage.count()).toBe(0);
    expect(await prisma.processedMessage.count()).toBe(1);
  });
});
