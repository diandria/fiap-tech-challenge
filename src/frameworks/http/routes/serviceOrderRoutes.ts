import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ServiceOrderController } from '../../../adapters/controllers/ServiceOrderController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';

const budgetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}-${req.params.id}`,
  message: { error: 'Too many attempts, please try again later' },
});

export function serviceOrderRoutes(controller: ServiceOrderController): Router {
  const router = Router();

  /**
   * @openapi
   * /service-orders/{id}/status:
   *   get:
   *     summary: Get OS status and budget total (public)
   *     tags: [Service Orders]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: OS status and budget
   *       404:
   *         description: Not found
   */
  router.get('/:id/status', (req, res, next) => controller.getStatus(req, res, next));

  /**
   * @openapi
   * /service-orders/{id}/budget:
   *   patch:
   *     summary: Customer budget decision — approve or reject (public)
   *     description: |
   *       Public endpoint authenticated by the 4-digit customer `code` (first 4 digits of CPF/CNPJ).
   *       Rate-limited to 5 req/h per IP+OS combination.
   *     tags: [Service Orders]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status, code]
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [APPROVED, REJECTED]
   *               code:
   *                 type: string
   *                 description: First 4 digits of customer CPF or CNPJ.
   *                 example: "5299"
   *     responses:
   *       200:
   *         description: Updated service order
   *       400:
   *         description: Invalid status, transition, or code
   *       429:
   *         description: Too many attempts
   */
  router.patch('/:id/budget', budgetLimiter, (req, res, next) => controller.budgetDecision(req, res, next));

  router.use(authMiddleware);

  /**
   * @openapi
   * /service-orders/{id}:
   *   patch:
   *     summary: Update OS status — internal state transitions (mechanic, admin)
   *     description: |
   *       Body-driven state transition for non-customer-facing transitions.
   *       Customer budget approval/rejection lives at `PATCH /service-orders/{id}/budget`.
   *       Side effect: the `DIAGNOSIS → WAITING_APPROVAL` transition fires a best-effort customer notification (MVP: `console.log` mock); failure does not roll back the status change.
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [DIAGNOSIS, WAITING_APPROVAL, EXECUTION, FINISHED, DELIVERED]
   *     responses:
   *       200:
   *         description: Updated service order
   *       400:
   *         description: Invalid status or transition
   *       401:
   *         description: Missing or invalid token
   *       403:
   *         description: Forbidden (wrong role)
   */
  router.patch('/:id', requireRole('mechanic', 'admin'), (req, res, next) => controller.updateStatus(req, res, next));

  /**
   * @openapi
   * /service-orders/stats/avg-execution:
   *   get:
   *     summary: Average execution time per service (authenticated)
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Array of avg execution results
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   serviceId: { type: string }
   *                   avgMinutes: { type: number }
   *                   count: { type: integer }
   */
  router.get('/stats/avg-execution', requireRole('attendant', 'admin'), (req, res, next) => controller.getAvgExecutionTime(req, res, next));

  /**
   * @openapi
   * /service-orders:
   *   get:
   *     summary: List service orders
   *     tags: [Service Orders]
   *     description: |
   *       Lista OS ativas. Por padrão, exclui OS com status `FINISHED` e `DELIVERED` e ordena por
   *       prioridade operacional: `EXECUTION` › `WAITING_APPROVAL` › `DIAGNOSIS` › `RECEIVED`,
   *       mais antigas primeiro dentro do mesmo status.
   *       Quando `?status` explícito é informado, a exclusão automática não se aplica — o sistema
   *       retorna exatamente as OS do status solicitado, na mesma ordenação de prioridade.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [RECEIVED, DIAGNOSIS, WAITING_APPROVAL, APPROVED, EXECUTION, FINISHED, DELIVERED, REJECTED]
   *         description: Quando informado, desabilita a exclusão automática de FINISHED e DELIVERED.
   *       - in: query
   *         name: customerId
   *         schema: { type: string }
   *       - in: query
   *         name: from
   *         schema: { type: string, format: date-time }
   *       - in: query
   *         name: to
   *         schema: { type: string, format: date-time }
   *     responses:
   *       200:
   *         description: Array de OS ativas ordenadas por prioridade operacional
   */
  router.get('/', (req, res, next) => controller.list(req, res, next));

  /**
   * @openapi
   * /service-orders:
   *   post:
   *     summary: Create a service order
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [customerId, vehicleId]
   *             properties:
   *               customerId:
   *                 type: string
   *               vehicleId:
   *                 type: string
   *               services:
   *                 type: array
   *                 description: Service IDs to include on creation (optional)
   *                 items:
   *                   type: string
   *               items:
   *                 type: array
   *                 description: Parts to include on creation with quantity (optional); stock reserved immediately
   *                 items:
   *                   type: object
   *                   required: [itemId, quantity]
   *                   properties:
   *                     itemId:
   *                       type: string
   *                     quantity:
   *                       type: integer
   *                       minimum: 1
   *     responses:
   *       201:
   *         description: Service order created with RECEIVED status and resolved services/items
   *       400:
   *         description: Insufficient stock for an item
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Service or item not found
   */
  router.post('/', requireRole('attendant', 'admin'), (req, res, next) => controller.create(req, res, next));

  /**
   * @openapi
   * /service-orders/{id}:
   *   get:
   *     summary: Get service order by ID
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Service order
   *       404:
   *         description: Not found
   */
  router.get('/:id', (req, res, next) => controller.getById(req, res, next));

  /**
   * @openapi
   * /service-orders/{id}/services:
   *   post:
   *     summary: Add a service to the OS (during DIAGNOSIS)
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [serviceId]
   *             properties:
   *               serviceId: { type: string }
   *     responses:
   *       200:
   *         description: Updated service order
   *       400:
   *         description: Wrong status or already added
   */
  router.post('/:id/services', requireRole('mechanic', 'admin'), (req, res, next) => controller.addServiceToOS(req, res, next));

  /**
   * @openapi
   * /service-orders/{id}/services/{serviceId}:
   *   patch:
   *     summary: Update individual service status during EXECUTION
   *     description: |
   *       Body-driven update. `IN_PROGRESS` records `startedAt`; `COMPLETED` records `finishedAt`.
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [status]
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [IN_PROGRESS, COMPLETED]
   *     responses:
   *       200:
   *         description: Updated service order
   *       400:
   *         description: Wrong OS status, invalid transition, or unsupported status
   *       404:
   *         description: Service not in order
   */
  router.patch('/:id/services/:serviceId', requireRole('mechanic', 'admin'), (req, res, next) => controller.updateServiceStatus(req, res, next));

  /**
   * @openapi
   * /service-orders/{id}/services/{serviceId}:
   *   delete:
   *     summary: Remove a service from the OS (during DIAGNOSIS)
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: serviceId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Updated service order
   *       400:
   *         description: Wrong status
   *       404:
   *         description: Service not in order
   */
  router.delete('/:id/services/:serviceId', requireRole('mechanic', 'admin'), (req, res, next) => controller.removeServiceFromOS(req, res, next));

  /**
   * @openapi
   * /service-orders/{id}/items:
   *   post:
   *     summary: Add an item to the OS and reserve stock (during DIAGNOSIS)
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [itemId, quantity]
   *             properties:
   *               itemId: { type: string }
   *               quantity: { type: integer, minimum: 1 }
   *     responses:
   *       200:
   *         description: Updated service order
   *       400:
   *         description: Insufficient stock or wrong status
   */
  router.post('/:id/items', requireRole('mechanic', 'admin'), (req, res, next) => controller.addItemToOS(req, res, next));

  /**
   * @openapi
   * /service-orders/{id}/items/{itemId}:
   *   delete:
   *     summary: Remove an item from the OS and release reservation (during DIAGNOSIS)
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: itemId
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Updated service order
   *       400:
   *         description: Wrong status
   *       404:
   *         description: Item not in order
   */
  router.delete('/:id/items/:itemId', requireRole('mechanic', 'admin'), (req, res, next) => controller.removeItemFromOS(req, res, next));

  return router;
}
