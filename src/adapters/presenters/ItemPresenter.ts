import { Item } from '../../entities/Item';

export class ItemPresenter {
  static list(data: Item[]): { status: number; body: Item[] } { return { status: 200, body: data }; }
  static ok(data: Item): { status: number; body: Item } { return { status: 200, body: data }; }
  static created(data: Item): { status: number; body: Item } { return { status: 201, body: data }; }
  static deleted(): { status: number; body: null } { return { status: 204, body: null }; }
}
