import { Request, Response, NextFunction } from 'express';
import { CreateServiceUseCase } from '../../use-cases/services/CreateServiceUseCase';
import { GetServiceByIdUseCase } from '../../use-cases/services/GetServiceByIdUseCase';
import { ListServicesUseCase } from '../../use-cases/services/ListServicesUseCase';
import { ListServicesAvgTimeUseCase } from '../../use-cases/services/ListServicesAvgTimeUseCase';
import { UpdateServiceUseCase } from '../../use-cases/services/UpdateServiceUseCase';
import { DeleteServiceUseCase } from '../../use-cases/services/DeleteServiceUseCase';
import { ServicePresenter } from '../presenters/ServicePresenter';

export class ServiceController {
  constructor(
    private readonly createService: CreateServiceUseCase,
    private readonly getService: GetServiceByIdUseCase,
    private readonly listServices: ListServicesUseCase,
    private readonly listServicesAvgTime: ListServicesAvgTimeUseCase,
    private readonly updateService: UpdateServiceUseCase,
    private readonly deleteService: DeleteServiceUseCase,
  ) {}

  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.listServices.execute();
      const { status, body } = ServicePresenter.list(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async listAvgTime(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.listServicesAvgTime.execute();
      const { status, body } = ServicePresenter.list(result as any);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.getService.execute(req.params.id);
      const { status, body } = ServicePresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.createService.execute(req.body);
      const { status, body } = ServicePresenter.created(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.updateService.execute(req.params.id, req.body);
      const { status, body } = ServicePresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.deleteService.execute(req.params.id);
      const { status } = ServicePresenter.deleted();
      res.sendStatus(status);
    } catch (err) { next(err); }
  }
}
