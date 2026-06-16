import { ServicePresenter } from '../../../../src/adapters/presenters/ServicePresenter';

const service = { id: 's1', name: 'Oil Change', price: 80, estimatedMinutes: 60, createdAt: new Date(), updatedAt: new Date() };

describe('ServicePresenter', () => {
  it('list returns 200', () => { expect(ServicePresenter.list([service])).toEqual({ status: 200, body: [service] }); });
  it('ok returns 200', () => { expect(ServicePresenter.ok(service)).toEqual({ status: 200, body: service }); });
  it('created returns 201', () => { expect(ServicePresenter.created(service)).toEqual({ status: 201, body: service }); });
  it('deleted returns 204', () => { expect(ServicePresenter.deleted()).toEqual({ status: 204, body: null }); });
});
