import { Request, Response, NextFunction } from 'express';
import { LoginUseCase } from '../../use-cases/auth/LoginUseCase';
import { RegisterUseCase } from '../../use-cases/auth/RegisterUseCase';
import { LookupCustomerByCpfUseCase } from '../../use-cases/customers/LookupCustomerByCpfUseCase';
import { AuthPresenter } from '../presenters/AuthPresenter';

export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly registerUseCase: RegisterUseCase,
    private readonly lookupCustomerUseCase: LookupCustomerByCpfUseCase,
  ) {}

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.loginUseCase.execute(req.body);
      const { status, body } = AuthPresenter.ok(result);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  /**
   * Consulta interna consumida pela function emissora de token. Nao ha
   * presenter: o corpo e o contrato da RFC-003, e passa-lo por um formatador de
   * cliente arriscaria acrescentar campos sem querer.
   */
  async lookupCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.lookupCustomerUseCase.execute(req.body?.cpf);
      res.status(200).json(result);
    } catch (err) { next(err); }
  }

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.registerUseCase.execute(req.body);
      const { status, body } = AuthPresenter.created(user);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }
}
