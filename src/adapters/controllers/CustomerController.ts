import { Request, Response, NextFunction } from 'express';
import { CreateCustomerUseCase } from '../../use-cases/customers/CreateCustomerUseCase';
import { GetCustomerByIdUseCase } from '../../use-cases/customers/GetCustomerByIdUseCase';
import { GetCustomerByTaxIdUseCase } from '../../use-cases/customers/GetCustomerByTaxIdUseCase';
import { ListCustomersUseCase } from '../../use-cases/customers/ListCustomersUseCase';
import { UpdateCustomerUseCase } from '../../use-cases/customers/UpdateCustomerUseCase';
import { DeleteCustomerUseCase } from '../../use-cases/customers/DeleteCustomerUseCase';
import { CustomerPresenter } from '../presenters/CustomerPresenter';

export class CustomerController {
  constructor(
    private readonly createCustomer: CreateCustomerUseCase,
    private readonly getCustomerById: GetCustomerByIdUseCase,
    private readonly getCustomerByTaxId: GetCustomerByTaxIdUseCase,
    private readonly listCustomers: ListCustomersUseCase,
    private readonly updateCustomer: UpdateCustomerUseCase,
    private readonly deleteCustomer: DeleteCustomerUseCase,
  ) {}

  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.listCustomers.execute();
      const { status, body } = CustomerPresenter.list(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.createCustomer.execute(req.body);
      const { status, body } = CustomerPresenter.created(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async getByTaxId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.getCustomerByTaxId.execute(req.params.taxId);
      const { status, body } = CustomerPresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.getCustomerById.execute(req.params.id);
      const { status, body } = CustomerPresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.updateCustomer.execute(req.params.id, req.body);
      const { status, body } = CustomerPresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.deleteCustomer.execute(req.params.id);
      const { status } = CustomerPresenter.deleted();
      res.sendStatus(status);
    } catch (err) { next(err); }
  }
}
