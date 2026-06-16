import { Request, Response, NextFunction } from 'express';
import { CreateItemUseCase } from '../../use-cases/items/CreateItemUseCase';
import { GetItemByIdUseCase } from '../../use-cases/items/GetItemByIdUseCase';
import { ListItemsUseCase } from '../../use-cases/items/ListItemsUseCase';
import { UpdateItemUseCase } from '../../use-cases/items/UpdateItemUseCase';
import { DeleteItemUseCase } from '../../use-cases/items/DeleteItemUseCase';
import { ItemPresenter } from '../presenters/ItemPresenter';

export class ItemController {
  constructor(
    private readonly createItem: CreateItemUseCase,
    private readonly getItem: GetItemByIdUseCase,
    private readonly listItems: ListItemsUseCase,
    private readonly updateItem: UpdateItemUseCase,
    private readonly deleteItem: DeleteItemUseCase,
  ) {}

  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.listItems.execute();
      const { status, body } = ItemPresenter.list(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.getItem.execute(req.params.id);
      const { status, body } = ItemPresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.createItem.execute(req.body);
      const { status, body } = ItemPresenter.created(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.updateItem.execute(req.params.id, req.body);
      const { status, body } = ItemPresenter.ok(data);
      res.status(status).json(body);
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.deleteItem.execute(req.params.id);
      const { status } = ItemPresenter.deleted();
      res.sendStatus(status);
    } catch (err) { next(err); }
  }
}
