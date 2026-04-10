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

  // --- Public ---

  router.get('/:id/status', async (req, res, next) => {
    try {
      const os = await getOS.execute(req.params.id);
      res.json({ id: os.id, status: os.status, budgetTotal: os.budgetTotal });
    } catch (err) { next(err); }
  });

  router.post('/:id/approve-budget', budgetLimiter, async (req, res, next) => {
    try {
      const os = await approveBudget.execute(req.params.id, req.body.code);
      res.json(os);
    } catch (err) { next(err); }
  });

  router.post('/:id/reject-budget', budgetLimiter, async (req, res, next) => {
    try {
      const os = await rejectBudget.execute(req.params.id, req.body.code);
      res.json(os);
    } catch (err) { next(err); }
  });

  // --- Authenticated ---
  router.use(authMiddleware);

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

  router.post('/', requireRole('attendant', 'admin'), async (req, res, next) => {
    try {
      const os = await createOS.execute(req.body);
      res.status(201).json(os);
    } catch (err) { next(err); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const os = await getOS.execute(req.params.id);
      res.json(os);
    } catch (err) { next(err); }
  });

  // Diagnosis
  router.patch('/:id/start-diagnosis', requireRole('attendant', 'admin'), async (req, res, next) => {
    try {
      const os = await startDiagnosis.execute(req.params.id);
      res.json(os);
    } catch (err) { next(err); }
  });

  router.patch('/:id/finish-diagnosis', requireRole('attendant', 'admin'), async (req, res, next) => {
    try {
      const os = await finishDiagnosis.execute(req.params.id);
      res.json(os);
    } catch (err) { next(err); }
  });

  // Line items
  router.post('/:id/services', requireRole('attendant', 'admin'), async (req, res, next) => {
    try {
      const os = await addService.execute(req.params.id, req.body.serviceId);
      res.json(os);
    } catch (err) { next(err); }
  });

  router.delete('/:id/services/:serviceId', requireRole('attendant', 'admin'), async (req, res, next) => {
    try {
      const os = await removeService.execute(req.params.id, req.params.serviceId);
      res.json(os);
    } catch (err) { next(err); }
  });

  router.post('/:id/items', requireRole('attendant', 'admin'), async (req, res, next) => {
    try {
      const os = await addItem.execute(req.params.id, req.body.itemId, req.body.quantity);
      res.json(os);
    } catch (err) { next(err); }
  });

  router.delete('/:id/items/:itemId', requireRole('attendant', 'admin'), async (req, res, next) => {
    try {
      const os = await removeItem.execute(req.params.id, req.params.itemId);
      res.json(os);
    } catch (err) { next(err); }
  });

  // Execution (mechanic)
  router.patch('/:id/start-execution', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const os = await startExecution.execute(req.params.id);
      res.json(os);
    } catch (err) { next(err); }
  });

  router.patch('/:id/services/:serviceId/start', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const os = await startService.execute(req.params.id, req.params.serviceId);
      res.json(os);
    } catch (err) { next(err); }
  });

  router.patch('/:id/services/:serviceId/finish', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const os = await finishService.execute(req.params.id, req.params.serviceId);
      res.json(os);
    } catch (err) { next(err); }
  });

  router.patch('/:id/finish', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const os = await finishOS.execute(req.params.id);
      res.json(os);
    } catch (err) { next(err); }
  });

  router.patch('/:id/deliver', requireRole('mechanic', 'admin'), async (req, res, next) => {
    try {
      const os = await deliverOS.execute(req.params.id);
      res.json(os);
    } catch (err) { next(err); }
  });

  return router;
}
