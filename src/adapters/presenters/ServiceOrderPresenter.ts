import { ServiceOrder } from '../../entities/ServiceOrder';
import { ServiceOrderHistory } from '../../use-cases/service-orders/GetServiceOrderHistoryUseCase';

export class ServiceOrderPresenter {
  static list(data: ServiceOrder[]): { status: number; body: ServiceOrder[] } { return { status: 200, body: data }; }
  static ok(data: ServiceOrder): { status: number; body: ServiceOrder } { return { status: 200, body: data }; }
  static created(data: ServiceOrder): { status: number; body: ServiceOrder } { return { status: 201, body: data }; }
  static status(data: { id: string; status: string; budgetTotal?: number }): { status: number; body: typeof data } { return { status: 200, body: data }; }
  static history(data: ServiceOrderHistory): { status: number; body: ServiceOrderHistory } { return { status: 200, body: data }; }
}
