import { Router } from 'express';
import { VehicleController } from '../../../adapters/controllers/VehicleController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';

export function vehicleRoutes(controller: VehicleController): Router {
  const router = Router();
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
  router.get('/', (req, res, next) => controller.list(req, res, next));

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
  router.post('/', (req, res, next) => controller.create(req, res, next));

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
  router.get('/:id', (req, res, next) => controller.getById(req, res, next));

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
  router.put('/:id', (req, res, next) => controller.update(req, res, next));

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
  router.delete('/:id', (req, res, next) => controller.delete(req, res, next));

  return router;
}
