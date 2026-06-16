export class AuthPresenter {
  static ok(data: { token: string }): { status: number; body: { token: string } } {
    return { status: 200, body: data };
  }
  static created(data: unknown): { status: number; body: unknown } {
    return { status: 201, body: data };
  }
}
