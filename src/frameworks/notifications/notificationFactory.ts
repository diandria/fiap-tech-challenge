import { SNSClient } from '@aws-sdk/client-sns';
import { INotificationService } from '../../use-cases/ports/INotificationService';
import { IIntegrationFailures } from '../../use-cases/ports/IIntegrationFailures';
import { ITraceContext } from '../../use-cases/ports/ITraceContext';
import { ConsoleNotificationService } from '../../adapters/services/ConsoleNotificationService';
import { SnsNotificationService } from '../../adapters/services/SnsNotificationService';
import { PrometheusIntegrationFailures } from '../metrics/PrometheusIntegrationFailures';
import { AsyncLocalStorageTraceContext } from '../logging/AsyncLocalStorageTraceContext';
import { logger } from '../logging/logger';

/**
 * Picks the notification implementation from the environment.
 *
 * The choice lives here, not inside a use case: to whoever publishes an event,
 * `console` and `sns` are interchangeable behind the same port. No use case
 * knows that SNS exists.
 */
export function createNotificationService(
  failures: IIntegrationFailures = new PrometheusIntegrationFailures(),
  traceContext: ITraceContext = new AsyncLocalStorageTraceContext(),
): INotificationService {
  if (process.env.NOTIFICATION_CHANNEL !== 'sns') {
    return new ConsoleNotificationService(logger, failures);
  }

  const topicArn = process.env.SNS_TOPIC_ARN;

  // Fails on startup, not on the first notification: otherwise the application
  // passes the probes and only reveals the gap when a customer needed warning.
  if (!topicArn) {
    throw new Error('NOTIFICATION_CHANNEL=sns requires SNS_TOPIC_ARN');
  }

  return new SnsNotificationService(new SNSClient({}), topicArn, failures, traceContext);
}
