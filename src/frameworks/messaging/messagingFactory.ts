import { Logger } from 'pino';
import { PrismaClient } from '@prisma/client';
import { SQSClient } from '@aws-sdk/client-sqs';
import { IServiceOrderSaga } from '../../use-cases/ports/input/IServiceOrderSaga';
import { PublishPendingMessagesUseCase } from '../../use-cases/messaging/PublishPendingMessagesUseCase';
import { PrismaOutboxStore } from '../../adapters/gateways/PrismaOutboxStore';
import { SqsMessageSender } from '../../adapters/messaging/SqsMessageSender';
import { SagaReplyHandler } from '../../adapters/messaging/SagaReplyHandler';
import { FailedCommandHandler } from '../../adapters/messaging/FailedCommandHandler';
import { PrometheusIntegrationFailures } from '../metrics/PrometheusIntegrationFailures';
import { registerOutboxBacklog } from '../metrics/outboxBacklog';
import { OutboxRelay } from './OutboxRelay';
import { SqsQueuePoller } from './SqsQueuePoller';
import { readQueueConfig } from './queueConfig';

export interface SagaMessaging {
  relay: OutboxRelay;
  pollers: SqsQueuePoller[];
  start(): void;
  /** Stops taking messages first, then lets the relay finish its cycle. */
  stop(): Promise<void>;
}

interface Dependencies {
  prisma: PrismaClient;
  saga: IServiceOrderSaga;
  logger: Logger;
  env?: Record<string, string | undefined>;
  sqs?: SQSClient;
}

/**
 * Builds the saga messaging from the environment, like the notification
 * factory: complete configuration turns it on, none leaves it off with a
 * warning, and half of it fails at startup instead of at the first message.
 */
export function createSagaMessaging({ prisma, saga, logger, env = process.env, sqs = new SQSClient({}) }: Dependencies): SagaMessaging | undefined {
  const queues = readQueueConfig(env);
  if (!queues) {
    logger.warn('saga queues are not configured; the service runs without messaging');
    return undefined;
  }

  const outbox = new PrismaOutboxStore(prisma);
  const sender = new SqsMessageSender(sqs, queues.commands, new PrometheusIntegrationFailures());
  const relay = new OutboxRelay(new PublishPendingMessagesUseCase(outbox, sender), logger);
  registerOutboxBacklog(() => outbox.countPending(), logger);

  const failedCommands = new FailedCommandHandler(saga);
  const pollers = [
    new SqsQueuePoller(sqs, { name: 'saga-replies', url: queues.sagaReplies }, new SagaReplyHandler(saga), logger),
    new SqsQueuePoller(sqs, { name: 'billing-commands-dlq', url: queues.deadLetters['billing-commands'] }, failedCommands, logger),
    new SqsQueuePoller(sqs, { name: 'execution-commands-dlq', url: queues.deadLetters['execution-commands'] }, failedCommands, logger),
  ];

  return {
    relay,
    pollers,
    start() {
      relay.start();
      for (const poller of pollers) poller.start();
      logger.info('saga messaging started');
    },
    async stop() {
      await Promise.all(pollers.map((poller) => poller.stop()));
      await relay.stop();
    },
  };
}
