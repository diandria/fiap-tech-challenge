import { Vehicle } from '../../entities/Vehicle';

export class VehiclePresenter {
  static list(data: Vehicle[]): { status: number; body: Vehicle[] } { return { status: 200, body: data }; }
  static ok(data: Vehicle): { status: number; body: Vehicle } { return { status: 200, body: data }; }
  static created(data: Vehicle): { status: number; body: Vehicle } { return { status: 201, body: data }; }
  static deleted(): { status: number; body: null } { return { status: 204, body: null }; }
}
