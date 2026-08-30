import { Request, Response, NextFunction } from 'express';
import { GetServiceOrderUseCase } from '../../use-cases/service-orders/GetServiceOrderUseCase';
import { ListServiceOrdersUseCase } from '../../use-cases/service-orders/ListServiceOrdersUseCase';
import { AddServiceToOSUseCase } from '../../use-cases/service-orders/AddServiceToOSUseCase';
import { RemoveServiceFromOSUseCase } from '../../use-cases/service-orders/RemoveServiceFromOSUseCase';
import { AddItemToOSUseCase } from '../../use-cases/service-orders/AddItemToOSUseCase';
import { RemoveItemFromOSUseCase } from '../../use-cases/service-orders/RemoveItemFromOSUseCase';
import { StartServiceUseCase } from '../../use-cases/service-orders/StartServiceUseCase';
import { FinishServiceUseCase } from '../../use-cases/service-orders/FinishServiceUseCase';
import { GetAvgExecutionTimeUseCase } from '../../use-cases/service-orders/GetAvgExecutionTimeUseCase';
import { ICreateServiceOrder } from '../../use-cases/ports/input/ICreateServiceOrder';
import { IChangeServiceOrderStatus } from '../../use-cases/ports/input/IChangeServiceOrderStatus';
import { IDecideBudget } from '../../use-cases/ports/input/IDecideBudget';
import { ServiceOrderPresenter } from '../presenters/ServiceOrderPresenter';
import { ValidationError } from '../../entities/errors/AppError';
import { ServiceOrder, OSStatus } from '../../entities/ServiceOrder';

/**
 * Extrai o dono da requisicao **do token**, nunca do corpo ou da query.
 *
 * Se viesse do cliente, a validacao de titularidade seria decorativa: bastaria
 * informar o ID de quem se quisesse consultar. Concentrar a leitura aqui deixa
 * um unico lugar para auditar essa garantia.
 *
 * Devolve undefined para funcionario, que nao e restrito por titularidade.
 */
function requesterCustomerId(req: Request): string | undefined {
  return req.user?.type === 'customer' ? req.user.sub : undefined;
}

export class ServiceOrderController {
  private readonly statusHandlers: Record<string, (id: string) => Promise<ServiceOrder>>;

  constructor(
    private readonly createOS: ICreateServiceOrder,
    private readonly getOS: GetServiceOrderUseCase,
    private readonly listOS: ListServiceOrdersUseCase,
    private readonly addService: AddServiceToOSUseCase,
    private readonly removeService: RemoveServiceFromOSUseCase,
    private readonly addItem: AddItemToOSUseCase,
    private readonly removeItem: RemoveItemFromOSUseCase,
    private readonly startDiagnosis: IChangeServiceOrderStatus,
    private readonly finishDiagnosis: IChangeServiceOrderStatus,
    private readonly approveBudget: IDecideBudget,
    private readonly rejectBudget: IDecideBudget,
    private readonly startExecution: IChangeServiceOrderStatus,
    private readonly startService: StartServiceUseCase,
    private readonly finishService: FinishServiceUseCase,
    private readonly finishOS: IChangeServiceOrderStatus,
    private readonly deliverOS: IChangeServiceOrderStatus,
    private readonly getAvgExecution: GetAvgExecutionTimeUseCase,
  ) {
    this.statusHandlers = {
      DIAGNOSIS: (id) => this.startDiagnosis.execute(id),
      WAITING_APPROVAL: (id) => this.finishDiagnosis.execute(id),
      EXECUTION: (id) => this.startExecution.execute(id),
      FINISHED: (id) => this.finishOS.execute(id),
      DELIVERED: (id) => this.deliverOS.execute(id),
    };
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.createOS.execute({
        customerId: req.body.customerId,
        vehicleId: req.body.vehicleId,
        services: req.body.services,
        items: req.body.items,
      });
      const { status, body } = ServiceOrderPresenter.created(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.getOS.execute({ osId: req.params.id });
      const { status, body } = ServiceOrderPresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.getOS.execute({
        osId: req.params.id,
        requesterCustomerId: requesterCustomerId(req),
      });
      const { status, body } = ServiceOrderPresenter.status({ id: data.id, status: data.status, budgetTotal: data.budgetTotal });
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status: statusFilter, customerId, from, to } = req.query as Record<string, string | undefined>;
      const data = await this.listOS.execute({
        status: statusFilter as OSStatus | undefined,
        customerId,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      });
      const { status, body } = ServiceOrderPresenter.list(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status: newStatus } = req.body;
      if (!newStatus) throw new ValidationError('status is required');
      const handler = this.statusHandlers[newStatus];
      if (!handler) throw new ValidationError(`Unknown status transition: ${newStatus}`);
      const data = await handler(id);
      const { status, body } = ServiceOrderPresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async budgetDecision(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status: decision, code } = req.body;
      if (!decision) throw new ValidationError('status is required');
      let data;
      switch (decision) {
        case 'APPROVED': data = await this.approveBudget.execute({ osId: id, code, requesterCustomerId: requesterCustomerId(req) }); break;
        case 'REJECTED': data = await this.rejectBudget.execute({ osId: id, code, requesterCustomerId: requesterCustomerId(req) }); break;
        default: throw new ValidationError(`Unsupported budget status: ${decision}`);
      }
      const { status, body } = ServiceOrderPresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async addServiceToOS(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.addService.execute(req.params.id, req.body.serviceId);
      const { status, body } = ServiceOrderPresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async removeServiceFromOS(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.removeService.execute(req.params.id, req.params.serviceId);
      const { status, body } = ServiceOrderPresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async addItemToOS(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.addItem.execute(req.params.id, req.body.itemId, req.body.quantity);
      const { status, body } = ServiceOrderPresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async removeItemFromOS(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.removeItem.execute(req.params.id, req.params.itemId);
      const { status, body } = ServiceOrderPresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async updateServiceStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const s = req.body?.status as 'IN_PROGRESS' | 'COMPLETED' | undefined;
      if (!s) throw new ValidationError('status is required');
      let data;
      switch (s) {
        case 'IN_PROGRESS': data = await this.startService.execute(req.params.id, req.params.serviceId); break;
        case 'COMPLETED': data = await this.finishService.execute(req.params.id, req.params.serviceId); break;
        default: throw new ValidationError(`Unsupported service status: ${s}`);
      }
      const { status, body } = ServiceOrderPresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async getAvgExecutionTime(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.getAvgExecution.execute();
      res.status(200).json(data);
    } catch (err) { next(err); }
  }
}
