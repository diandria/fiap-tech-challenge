import { SQSClient } from '@aws-sdk/client-sqs';
import { connectTestDB, disconnectTestDB, clearTestDB, prisma } from '../helpers/testSetup';
import { startLocalStack, stopLocalStack, createSagaQueues, receiveAll, SagaQueue, FifoQueue } from '../helpers/localstack';
import { PrismaUnitOfWork } from '../../src/adapters/gateways/PrismaUnitOfWork';
import { PrismaOutboxStore } from '../../src/adapters/gateways/PrismaOutboxStore';
import { SqsMessageSender } from '../../src/adapters/messaging/SqsMessageSender';
import { PublishPendingMessagesUseCase } from '../../src/use-cases/messaging/PublishPendingMessagesUseCase';

const serviceOrderId = '11111111-1111-4111-8111-111111111111';
const noTrace = { currentTraceparent: () => undefined };

let sqs: SQSClient;
let queues: Record<SagaQueue, FifoQueue>;
let publish: PublishPendingMessagesUseCase;

beforeAll(async () => {
  await connectTestDB();
  sqs = await startLocalStack();
  queues = await createSagaQueues(sqs);
  const sender = new SqsMessageSender(
    sqs,
    { 'billing-commands': queues['billing-commands'].url, 'execution-commands': queues['execution-commands'].url },
    { record: jest.fn() },
  );
  publish = new PublishPendingMessagesUseCase(new PrismaOutboxStore(prisma), sender);
});

afterAll(async () => {
  await stopLocalStack();
  await disconnectTestDB();
});

afterEach(async () => { await clearTestDB(); });

async function storeMessage(type: string): Promise<void> {
  await new PrismaUnitOfWork(prisma, noTrace).run(({ outbox }) =>
    outbox.add({ destination: 'billing-commands', type, serviceOrderId, payload: { step: type } }));
}

describe('Outbox relay', () => {
  it('GIVEN two pending messages for billing WHEN the relay runs once THEN both reach the billing queue in order and are marked published', async () => {
    // GIVEN
    await storeMessage('GenerateBudget');
    await storeMessage('RequestPayment');

    // WHEN
    const sent = await publish.execute(10);

    // THEN
    expect(sent).toBe(2);
    const messages = await receiveAll(sqs, queues['billing-commands'].url);
    expect(messages.map((m) => JSON.parse(m.Body ?? '{}').type)).toEqual(['GenerateBudget', 'RequestPayment']);
    expect(messages.every((m) => m.Attributes?.MessageGroupId === serviceOrderId)).toBe(true);
    expect(await prisma.outboxMessage.count({ where: { publishedAt: null } })).toBe(0);
  });

  it('GIVEN a message already published WHEN the relay runs again THEN it is not sent a second time', async () => {
    // GIVEN
    await storeMessage('CancelBudget');
    await publish.execute(10);
    await receiveAll(sqs, queues['billing-commands'].url);

    // WHEN
    const sent = await publish.execute(10);

    // THEN
    expect(sent).toBe(0);
  });
});
