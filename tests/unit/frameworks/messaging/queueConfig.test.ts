import { readQueueConfig } from '../../../../src/frameworks/messaging/queueConfig';

const complete = {
  QUEUE_URL_BILLING_COMMANDS: 'http://queues/billing.fifo',
  QUEUE_URL_EXECUTION_COMMANDS: 'http://queues/execution.fifo',
  QUEUE_URL_SAGA_REPLIES: 'http://queues/replies.fifo',
  DLQ_URL_BILLING_COMMANDS: 'http://queues/billing-dlq.fifo',
  DLQ_URL_EXECUTION_COMMANDS: 'http://queues/execution-dlq.fifo',
};

describe('readQueueConfig', () => {
  it('returns undefined when no queue url is set', () => {
    expect(readQueueConfig({})).toBeUndefined();
  });

  it('returns every queue when all urls are set', () => {
    expect(readQueueConfig(complete)).toEqual({
      commands: { 'billing-commands': 'http://queues/billing.fifo', 'execution-commands': 'http://queues/execution.fifo' },
      sagaReplies: 'http://queues/replies.fifo',
      deadLetters: { 'billing-commands': 'http://queues/billing-dlq.fifo', 'execution-commands': 'http://queues/execution-dlq.fifo' },
    });
  });

  it('throws naming the missing variable when only part of the urls is set', () => {
    const { QUEUE_URL_SAGA_REPLIES: _ignored, ...partial } = complete;

    expect(() => readQueueConfig(partial)).toThrow('QUEUE_URL_SAGA_REPLIES');
  });

  it('throws naming a missing dead-letter queue, which the saga needs to compensate failed steps', () => {
    const { DLQ_URL_EXECUTION_COMMANDS: _ignored, ...partial } = complete;

    expect(() => readQueueConfig(partial)).toThrow('DLQ_URL_EXECUTION_COMMANDS');
  });
});
