import { Router } from 'express';
import { MongoVehicleRepository } from '../../persistence/repositories/MongoVehicleRepository';
import { CreateVehicleUseCase } from '../../../application/use-cases/vehicles/CreateVehicleUseCase';
import { GetVehicleByIdUseCase } from '../../../application/use-cases/vehicles/GetVehicleByIdUseCase';
import { ListVehiclesUseCase } from '../../../application/use-cases/vehicles/ListVehiclesUseCase';
import { UpdateVehicleUseCase } from '../../../application/use-cases/vehicles/UpdateVehicleUseCase';
import { DeleteVehicleUseCase } from '../../../application/use-cases/vehicles/DeleteVehicleUseCase';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';

export function vehicleRoutes(): Router {
  const router = Router();
  const repo = new MongoVehicleRepository();
  const createVehicle = new CreateVehicleUseCase(repo);
  const getVehicle = new GetVehicleByIdUseCase(repo);
  const listVehicles = new ListVehiclesUseCase(repo);
  const updateVehicle = new UpdateVehicleUseCase(repo);
  const deleteVehicle = new DeleteVehicleUseCase(repo);

  router.use(authMiddleware);
  router.use(requireRole('attendant', 'admin'));

  /**
   * @openapi
   * /vehicles:
   *   get:
   *     summary: List vehicles (optionally filter by customerId)
   *     tags: [Vehicles]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: query
   *         name: customerId
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Array of vehicles
   */
  router.get('/', async (req, res, next) => {
    try {
      const customerId = req.query.customerId as string | undefined;
      const vehicles = await listVehicles.execute(customerId);
      res.json(vehicles);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /vehicles:
   *   post:
   *     summary: Register a vehicle
   *     tags: [Vehicles]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [customerId, plate, brand, model, year]
   *             properties:
   *               customerId: { type: string }
   *               plate: { type: string }
   *               brand: { type: string }
   *               model: { type: string }
   *               year: { type: integer }
   *     responses:
   *       201:
   *         description: Created vehicle
   *       400:
   *         description: Invalid plate format
   *       409:
   *         description: Plate already registered
   */
  router.post('/', async (req, res, next) => {
    try {
      const vehicle = await createVehicle.execute(req.body);
      res.status(201).json(vehicle);
    } catch (err) { next(err); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const vehicle = await getVehicle.execute(req.params.id);
      res.json(vehicle);
    } catch (err) { next(err); }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const vehicle = await updateVehicle.execute(req.params.id, req.body);
      res.json(vehicle);
    } catch (err) { next(err); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await deleteVehicle.execute(req.params.id);
      res.sendStatus(204);
    } catch (err) { next(err); }
  });

  return router;
}
