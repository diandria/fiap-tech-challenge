import { QueueUrls } from '../../adapters/messaging/SqsMessageSender';

export interface QueueConfig {
  commands: QueueUrls;
  sagaReplies: string;
}

const VARIABLES = ['QUEUE_URL_BILLING_COMMANDS', 'QUEUE_URL_EXECUTION_COMMANDS', 'QUEUE_URL_SAGA_REPLIES'] as const;

/**
 * Reads the saga queue urls. None set means messaging is off, which is the
 * case for local runs without queues; only part of them set is a mistake, and
 * failing at startup beats failing at the first message.
 */
export function readQueueConfig(env: Record<string, string | undefined> = process.env): QueueConfig | undefined {
  const missing = VARIABLES.filter((name) => !env[name]);
  if (missing.length === VARIABLES.length) return undefined;
  if (missing.length > 0) {
    throw new Error(`Saga messaging is partially configured; missing ${missing.join(', ')}`);
  }

  return {
    commands: {
      'billing-commands': env.QUEUE_URL_BILLING_COMMANDS as string,
      'execution-commands': env.QUEUE_URL_EXECUTION_COMMANDS as string,
    },
    sagaReplies: env.QUEUE_URL_SAGA_REPLIES as string,
  };
}
