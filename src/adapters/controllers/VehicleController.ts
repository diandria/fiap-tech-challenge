import { Request, Response, NextFunction } from 'express';
import { CreateVehicleUseCase } from '../../use-cases/vehicles/CreateVehicleUseCase';
import { GetVehicleByIdUseCase } from '../../use-cases/vehicles/GetVehicleByIdUseCase';
import { ListCustomerVehiclesUseCase } from '../../use-cases/vehicles/ListCustomerVehiclesUseCase';
import { UpdateVehicleUseCase } from '../../use-cases/vehicles/UpdateVehicleUseCase';
import { DeleteVehicleUseCase } from '../../use-cases/vehicles/DeleteVehicleUseCase';
import { VehiclePresenter } from '../presenters/VehiclePresenter';

export class VehicleController {
  constructor(
    private readonly createVehicle: CreateVehicleUseCase,
    private readonly getVehicle: GetVehicleByIdUseCase,
    private readonly listVehicles: ListCustomerVehiclesUseCase,
    private readonly updateVehicle: UpdateVehicleUseCase,
    private readonly deleteVehicle: DeleteVehicleUseCase,
  ) {}

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.listVehicles.execute(req.query.customerId as string | undefined);
      const { status, body } = VehiclePresenter.list(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.createVehicle.execute(req.body);
      const { status, body } = VehiclePresenter.created(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.getVehicle.execute(req.params.id);
      const { status, body } = VehiclePresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.updateVehicle.execute(req.params.id, req.body);
      const { status, body } = VehiclePresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.deleteVehicle.execute(req.params.id);
      const { status } = VehiclePresenter.deleted();
      res.sendStatus(status);
    } catch (err) { next(err); }
  }
}
