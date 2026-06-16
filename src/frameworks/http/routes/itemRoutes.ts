import { Router } from 'express';
import { ItemController } from '../../../adapters/controllers/ItemController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';

export function itemRoutes(controller: ItemController): Router {
  const router = Router();
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
  router.get('/', (req, res, next) => controller.list(req, res, next));

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
  router.get('/:id', (req, res, next) => controller.getById(req, res, next));

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
  router.post('/', requireRole('admin'), (req, res, next) => controller.create(req, res, next));

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
  router.put('/:id', requireRole('admin'), (req, res, next) => controller.update(req, res, next));

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
  router.delete('/:id', requireRole('admin'), (req, res, next) => controller.delete(req, res, next));

  return router;
}
