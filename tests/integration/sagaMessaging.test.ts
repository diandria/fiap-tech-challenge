import pino from 'pino';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { connectTestDB, disconnectTestDB, clearTestDB, prisma } from '../helpers/testSetup';
import { startLocalStack, stopLocalStack, createSagaQueues, receiveAll, SagaQueue, FifoQueue } from '../helpers/localstack';
import { PrismaUnitOfWork } from '../../src/adapters/gateways/PrismaUnitOfWork';
import { PostgresServiceRepository } from '../../src/adapters/gateways/PostgresServiceRepository';
import { PostgresCustomerRepository } from '../../src/adapters/gateways/PostgresCustomerRepository';
import { ServiceOrderSaga } from '../../src/use-cases/saga/ServiceOrderSaga';
import { createSagaMessaging, SagaMessaging } from '../../src/frameworks/messaging/messagingFactory';

let sqs: SQSClient;
let queues: Record<SagaQueue, FifoQueue>;
let messaging: SagaMessaging;

beforeAll(async () => {
  await connectTestDB();
  sqs = await startLocalStack();
  queues = await createSagaQueues(sqs);

  const saga = new ServiceOrderSaga(
    new PrismaUnitOfWork(prisma, { currentTraceparent: () => undefined }),
    new PostgresServiceRepository(prisma),
    new PostgresCustomerRepository(prisma),
    { execute: jest.fn() },
    { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  );
  const created = createSagaMessaging({
    prisma,
    saga,
    sqs,
    logger: pino({ level: 'silent' }),
    env: {
      QUEUE_URL_BILLING_COMMANDS: queues['billing-commands'].url,
      QUEUE_URL_EXECUTION_COMMANDS: queues['execution-commands'].url,
      QUEUE_URL_SAGA_REPLIES: queues['saga-replies'].url,
      DLQ_URL_BILLING_COMMANDS: queues['billing-commands'].deadLetterUrl,
      DLQ_URL_EXECUTION_COMMANDS: queues['execution-commands'].deadLetterUrl,
    },
  });
  if (!created) throw new Error('saga messaging should be configured in this test');
  messaging = created;
});

afterAll(async () => {
  await stopLocalStack();
  await disconnectTestDB();
});

afterEach(async () => { await clearTestDB(); });

async function seedOrderInDiagnosis(): Promise<string> {
  const customer = await prisma.customer.create({
    data: { name: 'Maria Souza', taxId: '52998224725', taxType: 'CPF', email: 'maria@example.com', phone: '11999999999' },
  });
  const vehicle = await prisma.vehicle.create({
    data: { customerId: customer.id, plate: 'ABC1D23', brand: 'Fiat', model: 'Uno', year: 2018 },
  });
  const service = await prisma.service.create({ data: { name: 'Oil change', price: 120, estimatedMinutes: 30 } });
  const order = await prisma.serviceOrder.create({
    data: { customerId: customer.id, vehicleId: vehicle.id, status: 'DIAGNOSIS', services: { create: [{ serviceId: service.id }] } },
  });
  return order.id;
}

describe('Saga messaging', () => {
  it('GIVEN an order in DIAGNOSIS and DiagnosisCompleted on the replies queue WHEN the poller and the relay run once THEN GenerateBudget reaches the billing commands queue', async () => {
    // GIVEN
    const orderId = await seedOrderInDiagnosis();
    await sqs.send(new SendMessageCommand({
      QueueUrl: queues['saga-replies'].url,
      MessageGroupId: orderId,
      MessageDeduplicationId: '77777777-7777-4777-8777-777777777777',
      MessageBody: JSON.stringify({
        messageId: '77777777-7777-4777-8777-777777777777',
        type: 'DiagnosisCompleted',
        serviceOrderId: orderId,
        occurredAt: new Date().toISOString(),
        payload: {},
      }),
    }));

    // WHEN
    await messaging.pollers[0].pollOnce();
    await messaging.relay.runOnce();

    // THEN
    expect((await prisma.serviceOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('WAITING_APPROVAL');
    const commands = await receiveAll(sqs, queues['billing-commands'].url);
    expect(commands.map((m) => JSON.parse(m.Body ?? '{}'))).toEqual([
      expect.objectContaining({ type: 'GenerateBudget', serviceOrderId: orderId }),
    ]);
    expect(commands[0].Attributes?.MessageGroupId).toBe(orderId);
  });
});
