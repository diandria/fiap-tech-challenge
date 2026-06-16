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
});
