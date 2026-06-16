import { Customer } from '../../entities/Customer';

export class CustomerPresenter {
  static list(data: Customer[]): { status: number; body: Customer[] } { return { status: 200, body: data }; }
  static ok(data: Customer): { status: number; body: Customer } { return { status: 200, body: data }; }
  static created(data: Customer): { status: number; body: Customer } { return { status: 201, body: data }; }
  static deleted(): { status: number; body: null } { return { status: 204, body: null }; }
}
