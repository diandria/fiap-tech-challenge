import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ServiceOrderController } from '../../../adapters/controllers/ServiceOrderController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole, requireCustomer, requireStaff } from '../middlewares/roleMiddleware';

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
   *     summary: Get OS status and budget total (customer only — own OS)
   *     tags: [Service Orders]
   *     security:
   *       - customerBearerAuth: []
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
  router.get('/:id/status', authMiddleware, requireCustomer, (req, res, next) => controller.getStatus(req, res, next));

  /**
   * @openapi
   * /service-orders/{id}/budget:
   *   patch:
   *     summary: Customer budget decision — approve or reject (customer only — own OS)
   *     description: |
   *       Requires the customer token issued at `POST /auth/cpf`, and the order must belong to that customer.
   *       The 4-digit `code` (first 4 digits of CPF/CNPJ) confirms the customer intended this decision.
   *       Rate-limited to 5 req/h per IP+OS combination.
   *     tags: [Service Orders]
   *     security:
   *       - customerBearerAuth: []
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
  router.patch('/:id/budget', budgetLimiter, authMiddleware, requireCustomer, (req, res, next) => controller.budgetDecision(req, res, next));

  /**
   * @openapi
   * /service-orders/{id}/history:
   *   get:
   *     summary: Status history of a service order (staff, or the customer who owns it)
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *       - customerBearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Status changes in chronological order; `from` is null for the opening
   *       401:
   *         description: Missing or invalid token
   *       403:
   *         description: Customer token for an order of another customer
   *       404:
   *         description: Not found
   */
  router.get('/:id/history', authMiddleware, (req, res, next) => controller.getHistory(req, res, next));

  router.use(authMiddleware);

  /**
   * @openapi
   * /service-orders/{id}:
   *   patch:
   *     summary: Record the delivery of a finished order (mechanic, admin)
   *     description: |
   *       Every other status is driven by the service order saga, from the replies of the Billing and
   *       Execution services: diagnosis, budget, payment and repair. Handing the car back to the customer
   *       is the one step still recorded by hand, and only `DELIVERED` is accepted here.
   *       Side effect: a best-effort customer notification, published to the events topic in production
   *       and logged in development; failure does not roll back the status change.
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
   *                 enum: [DELIVERED]
   *     responses:
   *       200:
   *         description: Updated service order
   *       400:
   *         description: Any status other than DELIVERED, or an order that is not FINISHED
   *       401:
   *         description: Missing or invalid token
   *       403:
   *         description: Forbidden (wrong role)
   */
  router.patch('/:id', requireRole('mechanic', 'admin'), (req, res, next) => controller.updateStatus(req, res, next));

  /**
   * @openapi
   * /service-orders:
   *   get:
   *     summary: List service orders
   *     tags: [Service Orders]
   *     description: |
   *       Lists active service orders. By default, excludes orders with status `FINISHED` and `DELIVERED`
   *       and sorts by operational priority: `EXECUTION` › `WAITING_APPROVAL` › `DIAGNOSIS` › `RECEIVED`,
   *       oldest first within the same status.
   *       When `?status` is explicitly provided, the automatic exclusion does not apply — the system
   *       returns exactly the orders with the requested status, in the same priority order.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [RECEIVED, DIAGNOSIS, WAITING_APPROVAL, APPROVED, PAID, EXECUTION, FINISHED, DELIVERED, REJECTED, CANCELLED]
   *         description: When provided, disables the automatic exclusion of FINISHED and DELIVERED orders.
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
   *         description: Array of active service orders sorted by operational priority
   *       403:
   *         description: Not a staff token
   */
  router.get('/', requireStaff, (req, res, next) => controller.list(req, res, next));

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
   *       403:
   *         description: Not a staff token
   *       404:
   *         description: Not found
   */
  router.get('/:id', requireStaff, (req, res, next) => controller.getById(req, res, next));

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
