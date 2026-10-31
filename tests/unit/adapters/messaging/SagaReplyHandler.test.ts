import { SagaReplyHandler } from '../../../../src/adapters/messaging/SagaReplyHandler';

const envelope = {
  messageId: '22222222-2222-4222-8222-222222222222',
  type: 'DiagnosisStarted',
  serviceOrderId: '11111111-1111-4111-8111-111111111111',
  occurredAt: '2026-10-31T10:00:00.000Z',
  payload: { note: 'kept' },
};

describe('SagaReplyHandler', () => {
  it('passes a typed reply to the saga and rejects an unknown type', async () => {
    const saga = { handle: jest.fn().mockResolvedValue({ outcome: 'applied' }) };
    const handler = new SagaReplyHandler(saga);

    await handler.handle(envelope);

    expect(saga.handle).toHaveBeenCalledWith({
      messageId: envelope.messageId,
      type: 'DiagnosisStarted',
      serviceOrderId: envelope.serviceOrderId,
      payload: { note: 'kept' },
    });
    await expect(handler.handle({ ...envelope, type: 'ShipParts' })).rejects.toThrow('ShipParts');
    expect(saga.handle).toHaveBeenCalledTimes(1);
  });
});
