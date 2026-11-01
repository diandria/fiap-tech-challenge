import pino from 'pino';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { connectTestDB, disconnectTestDB, clearTestDB, prisma } from '../helpers/testSetup';
import { startLocalStack, stopLocalStack, createFifoQueue, pollUntilDeadLettered, FifoQueue } from '../helpers/localstack';
import { PrismaUnitOfWork } from '../../src/adapters/gateways/PrismaUnitOfWork';
import { PostgresServiceRepository } from '../../src/adapters/gateways/PostgresServiceRepository';
import { PostgresCustomerRepository } from '../../src/adapters/gateways/PostgresCustomerRepository';
import { FailedCommandHandler } from '../../src/adapters/messaging/FailedCommandHandler';
import { SqsQueuePoller } from '../../src/frameworks/messaging/SqsQueuePoller';
import { ServiceOrderSaga } from '../../src/use-cases/saga/ServiceOrderSaga';

const silentLog = pino({ level: 'silent' });

let sqs: SQSClient;
let billingCommands: FifoQueue;
let saga: ServiceOrderSaga;

beforeAll(async () => {
  await connectTestDB();
  sqs = await startLocalStack();
  // Dead-letters on the first failed receive, so the test does not wait for five.
  billingCommands = await createFifoQueue(sqs, 'failed-command-billing', { maxReceiveCount: 1, visibilityTimeoutSeconds: 1 });
  saga = new ServiceOrderSaga(
    new PrismaUnitOfWork(prisma, { currentTraceparent: () => undefined }),
    new PostgresServiceRepository(prisma),
    new PostgresCustomerRepository(prisma),
    { execute: jest.fn() },
    { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  );
});

afterAll(async () => {
  await stopLocalStack();
  await disconnectTestDB();
});

afterEach(async () => { await clearTestDB(); });

async function seedOrderWaitingApproval(): Promise<string> {
  const customer = await prisma.customer.create({
    data: { name: 'Maria Souza', taxId: '52998224725', taxType: 'CPF', email: 'maria@example.com', phone: '11999999999' },
  });
  const vehicle = await prisma.vehicle.create({
    data: { customerId: customer.id, plate: 'ABC1D23', brand: 'Fiat', model: 'Uno', year: 2018 },
  });
  const order = await prisma.serviceOrder.create({
    data: { customerId: customer.id, vehicleId: vehicle.id, status: 'WAITING_APPROVAL' },
  });
  return order.id;
}

describe('Failed saga commands', () => {
  it('GIVEN a billing commands queue that dead-letters on the first failure WHEN GenerateBudget dies and the dead-letter poller runs THEN the order is CANCELLED', async () => {
    // GIVEN
    const orderId = await seedOrderWaitingApproval();
    await sqs.send(new SendMessageCommand({
      QueueUrl: billingCommands.url,
      MessageGroupId: orderId,
      MessageDeduplicationId: '66666666-6666-4666-8666-666666666666',
      MessageBody: JSON.stringify({
        messageId: '66666666-6666-4666-8666-666666666666',
        type: 'GenerateBudget',
        serviceOrderId: orderId,
        occurredAt: new Date().toISOString(),
        payload: { customer: {}, lines: [] },
      }),
    }));
    const billing = new SqsQueuePoller(
      sqs,
      { name: 'billing-commands', url: billingCommands.url },
      { handle: jest.fn().mockRejectedValue(new Error('billing cannot process it')) },
      silentLog,
      { waitTimeSeconds: 2 },
    );
    await pollUntilDeadLettered(sqs, billing, billingCommands.deadLetterUrl);
    const deadLetters = new SqsQueuePoller(
      sqs,
      { name: 'billing-commands-dlq', url: billingCommands.deadLetterUrl },
      new FailedCommandHandler(saga),
      silentLog,
      { waitTimeSeconds: 2 },
    );

    // WHEN
    const handled = await deadLetters.pollOnce();

    // THEN
    expect(handled).toBe(1);
    expect((await prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('CANCELLED');
    expect(await prisma.outboxMessage.findMany()).toEqual([
      expect.objectContaining({ destination: 'execution-commands', type: 'CancelExecution', payload: { reason: 'STEP_FAILED' } }),
    ]);
  });
});
