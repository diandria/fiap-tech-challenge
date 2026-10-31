import { FailedCommandHandler } from '../../../../src/adapters/messaging/FailedCommandHandler';

const envelope = {
  messageId: '22222222-2222-4222-8222-222222222222',
  type: 'GenerateBudget',
  serviceOrderId: '11111111-1111-4111-8111-111111111111',
  occurredAt: '2026-10-31T10:00:00.000Z',
  payload: { lines: [] },
};

describe('FailedCommandHandler', () => {
  it('hands the dead command to the saga and rejects an unknown type', async () => {
    const saga = { handle: jest.fn(), handleFailedCommand: jest.fn().mockResolvedValue({ outcome: 'applied' }) };
    const handler = new FailedCommandHandler(saga);

    await handler.handle(envelope);

    expect(saga.handleFailedCommand).toHaveBeenCalledWith({
      messageId: envelope.messageId,
      type: 'GenerateBudget',
      serviceOrderId: envelope.serviceOrderId,
    });
    await expect(handler.handle({ ...envelope, type: 'BudgetApproved' })).rejects.toThrow('BudgetApproved');
    expect(saga.handleFailedCommand).toHaveBeenCalledTimes(1);
  });
});
