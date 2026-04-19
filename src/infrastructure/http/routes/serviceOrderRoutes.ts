import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { MongoServiceOrderRepository } from '../../persistence/repositories/MongoServiceOrderRepository';
import { MongoCustomerRepository } from '../../persistence/repositories/MongoCustomerRepository';
import { MongoServiceRepository } from '../../persistence/repositories/MongoServiceRepository';
import { MongoItemRepository } from '../../persistence/repositories/MongoItemRepository';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';
import { CreateServiceOrderUseCase } from '../../../application/use-cases/service-orders/CreateServiceOrderUseCase';
import { GetServiceOrderUseCase } from '../../../application/use-cases/service-orders/GetServiceOrderUseCase';
import { ListServiceOrdersUseCase } from '../../../application/use-cases/service-orders/ListServiceOrdersUseCase';
import { AddServiceToOSUseCase } from '../../../application/use-cases/service-orders/AddServiceToOSUseCase';
import { RemoveServiceFromOSUseCase } from '../../../application/use-cases/service-orders/RemoveServiceFromOSUseCase';
import { AddItemToOSUseCase } from '../../../application/use-cases/service-orders/AddItemToOSUseCase';
import { RemoveItemFromOSUseCase } from '../../../application/use-cases/service-orders/RemoveItemFromOSUseCase';
import { StartDiagnosisUseCase } from '../../../application/use-cases/service-orders/StartDiagnosisUseCase';
import { FinishDiagnosisUseCase } from '../../../application/use-cases/service-orders/FinishDiagnosisUseCase';
import { ApproveBudgetUseCase } from '../../../application/use-cases/service-orders/ApproveBudgetUseCase';
import { RejectBudgetUseCase } from '../../../application/use-cases/service-orders/RejectBudgetUseCase';
import { StartExecutionUseCase } from '../../../application/use-cases/service-orders/StartExecutionUseCase';
import { StartServiceUseCase } from '../../../application/use-cases/service-orders/StartServiceUseCase';
import { FinishServiceUseCase } from '../../../application/use-cases/service-orders/FinishServiceUseCase';
import { FinishOSUseCase } from '../../../application/use-cases/service-orders/FinishOSUseCase';
import { DeliverOSUseCase } from '../../../application/use-cases/service-orders/DeliverOSUseCase';
import { GetAvgExecutionTimeUseCase } from '../../../application/use-cases/service-orders/GetAvgExecutionTimeUseCase';
import { OSStatus } from '../../../domain/entities/ServiceOrder';

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

  const createOS = new CreateServiceOrderUseCase(osRepo);
  const getOS = new GetServiceOrderUseCase(osRepo);
  const listOS = new ListServiceOrdersUseCase(osRepo);
  const addService = new AddServiceToOSUseCase(osRepo, serviceRepo);
  const removeService = new RemoveServiceFromOSUseCase(osRepo);
  const addItem = new AddItemToOSUseCase(osRepo, itemRepo);
  const removeItem = new RemoveItemFromOSUseCase(osRepo, itemRepo);
  const startDiagnosis = new StartDiagnosisUseCase(osRepo);
  const finishDiagnosis = new FinishDiagnosisUseCase(osRepo, serviceRepo, itemRepo);
  const approveBudget = new ApproveBudgetUseCase(osRepo, customerRepo);
  const rejectBudget = new RejectBudgetUseCase(osRepo, customerRepo, itemRepo);
  const startExecution = new StartExecutionUseCase(osRepo, itemRepo);
  const startService = new StartServiceUseCase(osRepo);
  const finishService = new FinishServiceUseCase(osRepo);
  const finishOS = new FinishOSUseCase(osRepo);
  const deliverOS = new DeliverOSUseCase(osRepo);
  const getAvgExecution = new GetAvgExecutionTimeUseCase(osRepo);

  // --- Public ---

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
  router.get('/stats/avg-execution', authMiddleware, async (req, res, next) => {
    try {
      const result = await getAvgExecution.execute();
      res.json(result);
    } catch (err) { next(err); }
  });

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
   * /service-orders/{id}/approve-budget:
   *   post:
   *     summary: Approve budget (public — requires customer 4-digit code)
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
   *             required: [code]
   *             properties:
   *               code:
   *                 type: string
   *                 description: First 4 digits of customer CPF or CNPJ
   *                 example: "5299"
   *     responses:
   *       200:
   *         description: OS approved
   *       400:
   *         description: Invalid code or wrong status
   *       429:
   *         description: Too many attempts
   */
  router.post('/:id/approve-budget', budgetLimiter, async (req, res, next) => {
    try {
      const os = await approveBudget.execute(req.params.id, req.body.code);
      res.json(os);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /service-orders/{id}/reject-budget:
   *   post:
   *     summary: Reject budget (public — requires customer 4-digit code)
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
   *             required: [code]
   *             properties:
   *               code:
   *                 type: string
   *                 description: First 4 digits of customer CPF or CNPJ
   *                 example: "5299"
   *     responses:
   *       200:
   *         description: OS rejected, reservations released
   *       400:
   *         description: Invalid code or wrong status
   *       429:
   *         description: Too many attempts
   */
  router.post('/:id/reject-budget', budgetLimiter, async (req, res, next) => {
    try {
      const os = await rejectBudget.execute(req.params.id, req.body.code);
      res.json(os);
    } catch (err) { next(err); }
  });

  // --- Authenticated ---
  router.use(authMiddleware);

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

  // Diagnosis
  /**
   * @openapi
   * /service-orders/{id}/start-diagnosis:
   *   patch:
   *     summary: Start diagnosis (RECEIVED → DIAGNOSIS)
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
   *         description: Updated service order
   *       400:
   *         description: Invalid status transition
   */
  router.patch('/:id/start-diagnosis', requireRole('attendant', 'admin'), async (req, res, next) => {
    try {
      const os = await startDiagnosis.execute(req.params.id);
      res.json(os);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /service-orders/{id}/finish-diagnosis:
   *   patch:
   *     summary: Finish diagnosis and calculate budget (DIAGNOSIS → WAITING_APPROVAL)
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
   *         description: Updated service order with budgetTotal
   *       400:
   *         description: Invalid status transition
   */
  router.patch('/:id/finish-diagnosis', requireRole('attendant', 'admin'), async (req, res, next) => {
    try {
      const os = await finishDiagnosis.execute(req.params.id);
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

  // Execution (mechanic)
  /**
   * @openapi
   * /service-orders/{id}/start-execution:
   *   patch:
   *     summary: Start execution — consumes reserved stock (APPROVED → EXECUTION)
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
   *         description: Updated service order
   *       400:
   *         description: Invalid status transition
   */
  router.patch('/:id/start-execution', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const os = await startExecution.execute(req.params.id);
      res.json(os);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /service-orders/{id}/services/{serviceId}/start:
   *   patch:
   *     summary: Start a specific service (records startedAt)
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
   *         description: Wrong OS status or service already started
   */
  router.patch('/:id/services/:serviceId/start', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const os = await startService.execute(req.params.id, req.params.serviceId);
      res.json(os);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /service-orders/{id}/services/{serviceId}/finish:
   *   patch:
   *     summary: Finish a specific service (records finishedAt)
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
   *         description: Wrong OS status, not started, or already finished
   */
  router.patch('/:id/services/:serviceId/finish', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const os = await finishService.execute(req.params.id, req.params.serviceId);
      res.json(os);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /service-orders/{id}/finish:
   *   patch:
   *     summary: Finish the OS (EXECUTION → FINISHED)
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
   *         description: Updated service order
   *       400:
   *         description: Invalid status transition
   */
  router.patch('/:id/finish', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const os = await finishOS.execute(req.params.id);
      res.json(os);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /service-orders/{id}/deliver:
   *   patch:
   *     summary: Deliver the OS to the customer (FINISHED → DELIVERED)
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
   *         description: Updated service order
   *       400:
   *         description: Invalid status transition
   */
  router.patch('/:id/deliver', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const os = await deliverOS.execute(req.params.id);
      res.json(os);
    } catch (err) { next(err); }
  });

  return router;
}
