import { Service } from '../../entities/Service';

export class ServicePresenter {
  static list(data: Service[]): { status: number; body: Service[] } { return { status: 200, body: data }; }
  static ok(data: Service): { status: number; body: Service } { return { status: 200, body: data }; }
  static created(data: Service): { status: number; body: Service } { return { status: 201, body: data }; }
  static deleted(): { status: number; body: null } { return { status: 204, body: null }; }
}
