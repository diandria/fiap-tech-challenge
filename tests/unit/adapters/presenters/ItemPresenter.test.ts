import { ItemPresenter } from '../../../../src/adapters/presenters/ItemPresenter';

const item = { id: 'i1', name: 'Oil Filter', price: 30, stockQuantity: 10, reservedQuantity: 2 };

describe('ItemPresenter', () => {
  it('list returns 200', () => { expect(ItemPresenter.list([item])).toEqual({ status: 200, body: [item] }); });
  it('ok returns 200', () => { expect(ItemPresenter.ok(item)).toEqual({ status: 200, body: item }); });
  it('created returns 201', () => { expect(ItemPresenter.created(item)).toEqual({ status: 201, body: item }); });
  it('deleted returns 204', () => { expect(ItemPresenter.deleted()).toEqual({ status: 204, body: null }); });
});
