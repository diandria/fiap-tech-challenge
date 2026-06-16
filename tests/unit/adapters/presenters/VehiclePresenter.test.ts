import { VehiclePresenter } from '../../../../src/adapters/presenters/VehiclePresenter';

const vehicle = { id: 'v1', customerId: 'c1', plate: 'ABC1234', brand: 'Ford', model: 'Ka', year: 2020, createdAt: new Date(), updatedAt: new Date() };

describe('VehiclePresenter', () => {
  it('list returns 200', () => { expect(VehiclePresenter.list([vehicle])).toEqual({ status: 200, body: [vehicle] }); });
  it('ok returns 200', () => { expect(VehiclePresenter.ok(vehicle)).toEqual({ status: 200, body: vehicle }); });
  it('created returns 201', () => { expect(VehiclePresenter.created(vehicle)).toEqual({ status: 201, body: vehicle }); });
  it('deleted returns 204', () => { expect(VehiclePresenter.deleted()).toEqual({ status: 204, body: null }); });
});
