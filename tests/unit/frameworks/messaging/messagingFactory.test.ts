import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { createSagaMessaging } from '../../../../src/frameworks/messaging/messagingFactory';

const saga = { handle: jest.fn(), handleFailedCommand: jest.fn() };
const prisma = {} as PrismaClient;

const complete = {
  QUEUE_URL_BILLING_COMMANDS: 'http://queues/billing.fifo',
  QUEUE_URL_EXECUTION_COMMANDS: 'http://queues/execution.fifo',
  QUEUE_URL_SAGA_REPLIES: 'http://queues/replies.fifo',
  DLQ_URL_BILLING_COMMANDS: 'http://queues/billing-dlq.fifo',
  DLQ_URL_EXECUTION_COMMANDS: 'http://queues/execution-dlq.fifo',
};

describe('createSagaMessaging', () => {
  it('returns nothing and warns when no queue url is set', () => {
    const logger = pino({ level: 'silent' });
    const warn = jest.spyOn(logger, 'warn');

    expect(createSagaMessaging({ prisma, saga, logger, env: {} })).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('throws when only part of the queue urls is set', () => {
    const { QUEUE_URL_SAGA_REPLIES: _ignored, ...partial } = complete;

    expect(() => createSagaMessaging({ prisma, saga, logger: pino({ level: 'silent' }), env: partial })).toThrow('QUEUE_URL_SAGA_REPLIES');
  });

  it('builds the relay and one poller for the replies and one for each command dead-letter queue', () => {
    const messaging = createSagaMessaging({ prisma, saga, logger: pino({ level: 'silent' }), env: complete });

    expect(messaging?.relay).toBeDefined();
    expect(messaging?.pollers.map((poller) => poller.queueName)).toEqual([
      'saga-replies', 'billing-commands-dlq', 'execution-commands-dlq',
    ]);
  });
});
