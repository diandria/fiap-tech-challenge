import { AuthPresenter } from '../../../../src/adapters/presenters/AuthPresenter';

describe('AuthPresenter', () => {
  it('ok wraps token in status 200', () => {
    expect(AuthPresenter.ok({ token: 'abc' })).toEqual({ status: 200, body: { token: 'abc' } });
  });

  it('created wraps data in status 201', () => {
    const user = { id: '1', email: 'a@a.com' };
    expect(AuthPresenter.created(user)).toEqual({ status: 201, body: user });
  });
});
