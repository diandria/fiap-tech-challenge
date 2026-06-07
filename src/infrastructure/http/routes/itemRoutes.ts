import { Router } from 'express';
import { MongoItemRepository } from '../../../adapters/gateways/MongoItemRepository';
import { CreateItemUseCase } from '../../../use-cases/items/CreateItemUseCase';
import { GetItemByIdUseCase } from '../../../use-cases/items/GetItemByIdUseCase';
import { ListItemsUseCase } from '../../../use-cases/items/ListItemsUseCase';
import { UpdateItemUseCase } from '../../../use-cases/items/UpdateItemUseCase';
import { DeleteItemUseCase } from '../../../use-cases/items/DeleteItemUseCase';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';

export function itemRoutes(): Router {
  const router = Router();
  const repo = new MongoItemRepository();
  const createItem = new CreateItemUseCase(repo);
  const getItem = new GetItemByIdUseCase(repo);
  const listItems = new ListItemsUseCase(repo);
  const updateItem = new UpdateItemUseCase(repo);
  const deleteItem = new DeleteItemUseCase(repo);

  router.use(authMiddleware);

  /**
   * @openapi
   * /items:
   *   get:
   *     summary: List all items with available quantity
   *     tags: [Items]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Array of items including availableQuantity
   */
  router.get('/', async (req, res, next) => {
    try {
      const items = await listItems.execute();
      res.json(items);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /items/{id}:
   *   get:
   *     summary: Get an item by ID
   *     tags: [Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Item including availableQuantity
   *       404:
   *         description: Not found
   */
  router.get('/:id', async (req, res, next) => {
    try {
      const item = await getItem.execute(req.params.id);
      res.json(item);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /items:
   *   post:
   *     summary: Create an inventory item (admin only)
   *     tags: [Items]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, price, stockQuantity]
   *             properties:
   *               name: { type: string }
   *               price: { type: number, minimum: 0 }
   *               stockQuantity: { type: integer, minimum: 0 }
   *     responses:
   *       201:
   *         description: Created item
   *       400:
   *         description: Validation error
   */
  router.post('/', requireRole('admin'), async (req, res, next) => {
    try {
      const item = await createItem.execute(req.body);
      res.status(201).json(item);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /items/{id}:
   *   put:
   *     summary: Update an item (admin only)
   *     tags: [Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name: { type: string }
   *               price: { type: number, minimum: 0 }
   *               stockQuantity: { type: integer, minimum: 0 }
   *     responses:
   *       200:
   *         description: Updated item
   *       400:
   *         description: Validation error
   *       404:
   *         description: Not found
   */
  router.put('/:id', requireRole('admin'), async (req, res, next) => {
    try {
      const item = await updateItem.execute(req.params.id, req.body);
      res.json(item);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /items/{id}:
   *   delete:
   *     summary: Delete an item (admin only, fails if stock is reserved)
   *     tags: [Items]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       204:
   *         description: Deleted
   *       400:
   *         description: Item has active reservations
   *       404:
   *         description: Not found
   */
  router.delete('/:id', requireRole('admin'), async (req, res, next) => {
    try {
      await deleteItem.execute(req.params.id);
      res.sendStatus(204);
    } catch (err) { next(err); }
  });

  return router;
}
