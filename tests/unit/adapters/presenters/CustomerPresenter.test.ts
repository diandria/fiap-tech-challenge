import { CustomerPresenter } from '../../../../src/adapters/presenters/CustomerPresenter';
import { cpfCustomer } from '../../fixtures/customer';

describe('CustomerPresenter', () => {
  it('list returns 200 with array', () => {
    expect(CustomerPresenter.list([cpfCustomer])).toEqual({ status: 200, body: [cpfCustomer] });
  });
  it('ok returns 200 with entity', () => {
    expect(CustomerPresenter.ok(cpfCustomer)).toEqual({ status: 200, body: cpfCustomer });
  });
  it('created returns 201 with entity', () => {
    expect(CustomerPresenter.created(cpfCustomer)).toEqual({ status: 201, body: cpfCustomer });
  });
  it('deleted returns 204 with null body', () => {
    expect(CustomerPresenter.deleted()).toEqual({ status: 204, body: null });
  });
});
