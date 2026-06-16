import { ServiceOrder } from '../../entities/ServiceOrder';

export class ServiceOrderPresenter {
  static list(data: ServiceOrder[]): { status: number; body: ServiceOrder[] } { return { status: 200, body: data }; }
  static ok(data: ServiceOrder): { status: number; body: ServiceOrder } { return { status: 200, body: data }; }
  static created(data: ServiceOrder): { status: number; body: ServiceOrder } { return { status: 201, body: data }; }
  static status(data: { id: string; status: string; budgetTotal?: number }): { status: number; body: typeof data } { return { status: 200, body: data }; }
}
