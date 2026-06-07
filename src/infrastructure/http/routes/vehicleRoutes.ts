import { Router } from 'express';
import { MongoVehicleRepository } from '../../../adapters/gateways/MongoVehicleRepository';
import { CreateVehicleUseCase } from '../../../use-cases/vehicles/CreateVehicleUseCase';
import { GetVehicleByIdUseCase } from '../../../use-cases/vehicles/GetVehicleByIdUseCase';
import { ListCustomerVehiclesUseCase } from '../../../use-cases/vehicles/ListCustomerVehiclesUseCase';
import { UpdateVehicleUseCase } from '../../../use-cases/vehicles/UpdateVehicleUseCase';
import { DeleteVehicleUseCase } from '../../../use-cases/vehicles/DeleteVehicleUseCase';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';

export function vehicleRoutes(): Router {
  const router = Router();
  const repo = new MongoVehicleRepository();
  const createVehicle = new CreateVehicleUseCase(repo);
  const getVehicle = new GetVehicleByIdUseCase(repo);
  const listVehicles = new ListCustomerVehiclesUseCase(repo);
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

  /**
   * @openapi
   * /vehicles/{id}:
   *   get:
   *     summary: Get a vehicle by ID
   *     tags: [Vehicles]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Vehicle object
   *       404:
   *         description: Not found
   */
  router.get('/:id', async (req, res, next) => {
    try {
      const vehicle = await getVehicle.execute(req.params.id);
      res.json(vehicle);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /vehicles/{id}:
   *   put:
   *     summary: Update a vehicle
   *     tags: [Vehicles]
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
   *               plate: { type: string }
   *               brand: { type: string }
   *               model: { type: string }
   *               year: { type: integer }
   *     responses:
   *       200:
   *         description: Updated vehicle
   *       400:
   *         description: Invalid plate format
   *       404:
   *         description: Not found
   *       409:
   *         description: Plate already registered
   */
  router.put('/:id', async (req, res, next) => {
    try {
      const vehicle = await updateVehicle.execute(req.params.id, req.body);
      res.json(vehicle);
    } catch (err) { next(err); }
  });

  /**
   * @openapi
   * /vehicles/{id}:
   *   delete:
   *     summary: Delete a vehicle
   *     tags: [Vehicles]
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
  router.delete('/:id', async (req, res, next) => {
    try {
      await deleteVehicle.execute(req.params.id);
      res.sendStatus(204);
    } catch (err) { next(err); }
  });

  return router;
}
