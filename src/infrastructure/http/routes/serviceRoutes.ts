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

  /**
   * @openapi
   * /services/{id}:
   *   get:
   *     summary: Get a service by ID
   *     tags: [Services]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Service object
   *       404:
   *         description: Not found
   */
  router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
      const service = await getService.execute(req.params.id);
      res.json(service);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /services:
   *   post:
   *     summary: Create a service (admin only)
   *     tags: [Services]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, price, estimatedMinutes]
   *             properties:
   *               name: { type: string }
   *               price: { type: number, minimum: 0 }
   *               estimatedMinutes: { type: integer, minimum: 0 }
   *     responses:
   *       201:
   *         description: Created service
   *       400:
   *         description: Validation error
   */
  router.post('/', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
      const service = await createService.execute(req.body);
      res.status(201).json(service);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /services/{id}:
   *   put:
   *     summary: Update a service (admin only)
   *     tags: [Services]
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
   *               estimatedMinutes: { type: integer, minimum: 0 }
   *     responses:
   *       200:
   *         description: Updated service
   *       400:
   *         description: Validation error
   *       404:
   *         description: Not found
   */
  router.put('/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
      const service = await updateService.execute(req.params.id, req.body);
      res.json(service);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /services/{id}:
   *   delete:
   *     summary: Delete a service (admin only)
   *     tags: [Services]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       204:
   *         description: Deleted
   *       404:
   *         description: Not found
   */
  router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
      await deleteService.execute(req.params.id);
      res.sendStatus(204);
    } catch (err) { next(err); }
  });

  return router;
}
