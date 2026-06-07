import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { MongoServiceOrderRepository } from '../../../adapters/gateways/MongoServiceOrderRepository';
import { MongoCustomerRepository } from '../../../adapters/gateways/MongoCustomerRepository';
import { MongoServiceRepository } from '../../../adapters/gateways/MongoServiceRepository';
import { MongoItemRepository } from '../../../adapters/gateways/MongoItemRepository';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';
import { CreateServiceOrderUseCase } from '../../../use-cases/service-orders/CreateServiceOrderUseCase';
import { GetServiceOrderUseCase } from '../../../use-cases/service-orders/GetServiceOrderUseCase';
import { ListServiceOrdersUseCase } from '../../../use-cases/service-orders/ListServiceOrdersUseCase';
import { AddServiceToOSUseCase } from '../../../use-cases/service-orders/AddServiceToOSUseCase';
import { RemoveServiceFromOSUseCase } from '../../../use-cases/service-orders/RemoveServiceFromOSUseCase';
import { AddItemToOSUseCase } from '../../../use-cases/service-orders/AddItemToOSUseCase';
import { RemoveItemFromOSUseCase } from '../../../use-cases/service-orders/RemoveItemFromOSUseCase';
import { StartDiagnosisUseCase } from '../../../use-cases/service-orders/StartDiagnosisUseCase';
import { FinishDiagnosisUseCase } from '../../../use-cases/service-orders/FinishDiagnosisUseCase';
import { ApproveBudgetUseCase } from '../../../use-cases/service-orders/ApproveBudgetUseCase';
import { RejectBudgetUseCase } from '../../../use-cases/service-orders/RejectBudgetUseCase';
import { StartExecutionUseCase } from '../../../use-cases/service-orders/StartExecutionUseCase';
import { StartServiceUseCase } from '../../../use-cases/service-orders/StartServiceUseCase';
import { FinishServiceUseCase } from '../../../use-cases/service-orders/FinishServiceUseCase';
import { FinishOSUseCase } from '../../../use-cases/service-orders/FinishOSUseCase';
import { DeliverOSUseCase } from '../../../use-cases/service-orders/DeliverOSUseCase';
import { GetAvgExecutionTimeUseCase } from '../../../use-cases/service-orders/GetAvgExecutionTimeUseCase';
import { ConsoleNotificationService } from '../../notifications/ConsoleNotificationService';
import { OSStatus } from '../../../entities/ServiceOrder';
import { ValidationError } from '../../../entities/errors/AppError';

const budgetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `${req.ip}-${req.params.id}`,
  message: { error: 'Too many attempts, please try again later' },
});

export function serviceOrderRoutes(): Router {
  const router = Router();

  const osRepo = new MongoServiceOrderRepository();
  const customerRepo = new MongoCustomerRepository();
  const serviceRepo = new MongoServiceRepository();
  const itemRepo = new MongoItemRepository();
  const notifier = new ConsoleNotificationService();

  const createOS = new CreateServiceOrderUseCase(osRepo);
  const getOS = new GetServiceOrderUseCase(osRepo);
  const listOS = new ListServiceOrdersUseCase(osRepo);
  const addService = new AddServiceToOSUseCase(osRepo, serviceRepo);
  const removeService = new RemoveServiceFromOSUseCase(osRepo);
  const addItem = new AddItemToOSUseCase(osRepo, itemRepo);
  const removeItem = new RemoveItemFromOSUseCase(osRepo, itemRepo);
  const startDiagnosis = new StartDiagnosisUseCase(osRepo);
  const finishDiagnosis = new FinishDiagnosisUseCase(osRepo, serviceRepo, itemRepo, customerRepo, notifier);
  const approveBudget = new ApproveBudgetUseCase(osRepo, customerRepo);
  const rejectBudget = new RejectBudgetUseCase(osRepo, customerRepo, itemRepo);
  const startExecution = new StartExecutionUseCase(osRepo, itemRepo);
  const startService = new StartServiceUseCase(osRepo);
  const finishService = new FinishServiceUseCase(osRepo);
  const finishOS = new FinishOSUseCase(osRepo);
  const deliverOS = new DeliverOSUseCase(osRepo);
  const getAvgExecution = new GetAvgExecutionTimeUseCase(osRepo);

  // --- Public endpoints (defined before authMiddleware) ---

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
  router.get('/:id/status', async (req, res, next) => {
    try {
      const os = await getOS.execute(req.params.id);
      res.json({ id: os.id, status: os.status, budgetTotal: os.budgetTotal });
    } catch (err) { next(err); }
  });

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
  router.patch('/:id/budget', budgetLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = req.body?.status as OSStatus | undefined;
      if (!status) throw new ValidationError('status is required');

      const id = req.params.id;
      let updated;

      switch (status) {
        case 'APPROVED':
          updated = await approveBudget.execute(id, req.body?.code);
          break;
        case 'REJECTED':
          updated = await rejectBudget.execute(id, req.body?.code);
          break;
        default:
          throw new ValidationError(`Unsupported budget status: ${status}`);
      }

      res.json(updated);
    } catch (err) { next(err); }
  });

  // --- Authenticated endpoints ---
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
  router.patch('/:id', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const status = req.body?.status as OSStatus | undefined;
      if (!status) throw new ValidationError('status is required');

      const id = req.params.id;
      let updated;

      switch (status) {
        case 'DIAGNOSIS':
          updated = await startDiagnosis.execute(id);
          break;
        case 'WAITING_APPROVAL':
          updated = await finishDiagnosis.execute(id);
          break;
        case 'EXECUTION':
          updated = await startExecution.execute(id);
          break;
        case 'FINISHED':
          updated = await finishOS.execute(id);
          break;
        case 'DELIVERED':
          updated = await deliverOS.execute(id);
          break;
        default:
          throw new ValidationError(`Unsupported target status: ${status}`);
      }

      res.json(updated);
    } catch (err) { next(err); }
  });

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
  router.get('/stats/avg-execution', requireRole('attendant', 'admin'), async (req, res, next) => {
    try {
      const result = await getAvgExecution.execute();
      res.json(result);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /service-orders:
   *   get:
   *     summary: List service orders
   *     tags: [Service Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [RECEIVED, DIAGNOSIS, WAITING_APPROVAL, APPROVED, EXECUTION, FINISHED, DELIVERED, REJECTED]
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
   *         description: Array of service orders
   */
  router.get('/', async (req, res, next) => {
    try {
      const { status, customerId, from, to } = req.query as Record<string, string>;
      const orders = await listOS.execute({
        status: status as OSStatus | undefined,
        customerId,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      });
      res.json(orders);
    } catch (err) { next(err); }
  });

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
   *               customerId: { type: string }
   *               vehicleId: { type: string }
   *     responses:
   *       201:
   *         description: Service order created with RECEIVED status
   *       403:
   *         description: Forbidden
   */
  router.post('/', requireRole('attendant', 'admin'), async (req, res, next) => {
    try {
      const os = await createOS.execute(req.body);
      res.status(201).json(os);
    } catch (err) { next(err); }
  });

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
  router.get('/:id', async (req, res, next) => {
    try {
      const os = await getOS.execute(req.params.id);
      res.json(os);
    } catch (err) { next(err); }
  });

  // Line items
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
  router.post('/:id/services', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const os = await addService.execute(req.params.id, req.body.serviceId);
      res.json(os);
    } catch (err) { next(err); }
  });

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
  router.patch('/:id/services/:serviceId', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const status = req.body?.status as 'IN_PROGRESS' | 'COMPLETED' | undefined;
      if (!status) throw new ValidationError('status is required');

      let updated;
      switch (status) {
        case 'IN_PROGRESS':
          updated = await startService.execute(req.params.id, req.params.serviceId);
          break;
        case 'COMPLETED':
          updated = await finishService.execute(req.params.id, req.params.serviceId);
          break;
        default:
          throw new ValidationError(`Unsupported service status: ${status}`);
      }
      res.json(updated);
    } catch (err) { next(err); }
  });

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
  router.delete('/:id/services/:serviceId', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const os = await removeService.execute(req.params.id, req.params.serviceId);
      res.json(os);
    } catch (err) { next(err); }
  });

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
  router.post('/:id/items', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const os = await addItem.execute(req.params.id, req.body.itemId, req.body.quantity);
      res.json(os);
    } catch (err) { next(err); }
  });

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
  router.delete('/:id/items/:itemId', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const os = await removeItem.execute(req.params.id, req.params.itemId);
      res.json(os);
    } catch (err) { next(err); }
  });

  return router;
}
