import { Router } from 'express';
import { MongoServiceRepository } from '../../persistence/repositories/MongoServiceRepository';
import { CreateServiceUseCase } from '../../../application/use-cases/services/CreateServiceUseCase';
import { GetServiceByIdUseCase } from '../../../application/use-cases/services/GetServiceByIdUseCase';
import { ListServicesUseCase } from '../../../application/use-cases/services/ListServicesUseCase';
import { UpdateServiceUseCase } from '../../../application/use-cases/services/UpdateServiceUseCase';
import { DeleteServiceUseCase } from '../../../application/use-cases/services/DeleteServiceUseCase';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';

export function serviceRoutes(): Router {
  const router = Router();
  const repo = new MongoServiceRepository();
  const createService = new CreateServiceUseCase(repo);
  const getService = new GetServiceByIdUseCase(repo);
  const listServices = new ListServicesUseCase(repo);
  const updateService = new UpdateServiceUseCase(repo);
  const deleteService = new DeleteServiceUseCase(repo);

  /**
   * @openapi
   * /services:
   *   get:
   *     summary: List all services
   *     tags: [Services]
   *     responses:
   *       200:
   *         description: Array of services
   */
  router.get('/', async (req, res, next) => {
    try {
      const services = await listServices.execute();
      res.json(services);
    } catch (err) { next(err); }
  });

  router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
      const service = await getService.execute(req.params.id);
      res.json(service);
    } catch (err) { next(err); }
  });

  router.post('/', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
      const service = await createService.execute(req.body);
      res.status(201).json(service);
    } catch (err) { next(err); }
  });

  router.put('/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
      const service = await updateService.execute(req.params.id, req.body);
      res.json(service);
    } catch (err) { next(err); }
  });

  router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
      await deleteService.execute(req.params.id);
      res.sendStatus(204);
    } catch (err) { next(err); }
  });

  return router;
}
