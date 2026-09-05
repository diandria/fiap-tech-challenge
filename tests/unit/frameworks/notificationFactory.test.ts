import { createNotificationService } from '../../../src/frameworks/notifications/notificationFactory';
import { ConsoleNotificationService } from '../../../src/adapters/services/ConsoleNotificationService';
import { SnsNotificationService } from '../../../src/adapters/services/SnsNotificationService';

describe('createNotificationService', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('should return the console implementation GIVEN no channel configured', () => {
    delete process.env.NOTIFICATION_CHANNEL;

    expect(createNotificationService()).toBeInstanceOf(ConsoleNotificationService);
  });

  it('should return the console implementation GIVEN an unknown channel', () => {
    process.env.NOTIFICATION_CHANNEL = 'carta-registrada';

    expect(createNotificationService()).toBeInstanceOf(ConsoleNotificationService);
  });

  it('should return the sns implementation GIVEN channel sns and a topic arn', () => {
    process.env.NOTIFICATION_CHANNEL = 'sns';
    process.env.SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:000000000000:topic';

    expect(createNotificationService()).toBeInstanceOf(SnsNotificationService);
  });

  // Fail on startup, not on the first notification: otherwise the gap only
  // shows when a customer needed warning.
  it('should throw GIVEN channel sns without a topic arn', () => {
    process.env.NOTIFICATION_CHANNEL = 'sns';
    delete process.env.SNS_TOPIC_ARN;

    expect(() => createNotificationService()).toThrow(/SNS_TOPIC_ARN/);
  });
});
