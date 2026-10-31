import { ServiceOrderPresenter } from '../../../../src/adapters/presenters/ServiceOrderPresenter';
import { baseOS } from '../../fixtures/serviceOrder';

const os = baseOS;

describe('ServiceOrderPresenter', () => {
  it('list returns 200', () => { expect(ServiceOrderPresenter.list([os])).toEqual({ status: 200, body: [os] }); });
  it('ok returns 200', () => { expect(ServiceOrderPresenter.ok(os)).toEqual({ status: 200, body: os }); });
  it('created returns 201', () => { expect(ServiceOrderPresenter.created(os)).toEqual({ status: 201, body: os }); });
  it('status returns 200 with id, status and budgetTotal', () => {
    const data = { id: os.id, status: os.status, budgetTotal: os.budgetTotal };
    expect(ServiceOrderPresenter.status(data)).toEqual({ status: 200, body: data });
  });
  it('history returns 200 with the order id and its changes', () => {
    const data = { serviceOrderId: os.id, history: [{ from: null, to: 'RECEIVED' as const, changedAt: new Date('2026-01-01') }] };
    expect(ServiceOrderPresenter.history(data)).toEqual({ status: 200, body: data });
  });
});
