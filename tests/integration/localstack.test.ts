import { SQSClient, ListQueuesCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { startLocalStack, stopLocalStack, createSagaQueues } from '../helpers/localstack';

let sqs: SQSClient;

beforeAll(async () => { sqs = await startLocalStack(); });
afterAll(async () => { await stopLocalStack(); });

describe('LocalStack queues for the saga', () => {
  it('GIVEN LocalStack running WHEN the saga queues are created THEN the three fifo queues and their dead-letter queues exist', async () => {
    // GIVEN
    // a LocalStack container with no queues

    // WHEN
    const queues = await createSagaQueues(sqs);

    // THEN
    const listed = await sqs.send(new ListQueuesCommand({ QueueNamePrefix: 'car-repair-shop-' }));
    expect(listed.QueueUrls).toHaveLength(6);
    const replies = await sqs.send(new GetQueueAttributesCommand({
      QueueUrl: queues['saga-replies'].url,
      AttributeNames: ['FifoQueue', 'RedrivePolicy'],
    }));
    expect(replies.Attributes?.FifoQueue).toBe('true');
    expect(JSON.parse(replies.Attributes?.RedrivePolicy ?? '{}').maxReceiveCount).toBe('5');
  });
});
