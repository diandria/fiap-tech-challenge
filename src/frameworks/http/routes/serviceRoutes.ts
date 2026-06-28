import { Router } from 'express';
import { ServiceController } from '../../../adapters/controllers/ServiceController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';

export function serviceRoutes(controller: ServiceController): Router {
  const router = Router();

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
  router.get('/', (req, res, next) => controller.list(req, res, next));

  /**
   * @openapi
   * /services/avg-time:
   *   get:
   *     summary: List services with their registered average execution time (admin, mechanic, attendant)
   *     tags: [Services]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Array of services with id, name and estimatedMinutes
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id: { type: string }
   *                   name: { type: string }
   *                   estimatedMinutes: { type: integer, minimum: 0 }
   *       401:
   *         description: Missing or invalid token
   *       403:
   *         description: Forbidden role
   */
  router.get('/avg-time', authMiddleware, requireRole('admin', 'mechanic', 'attendant'), (req, res, next) => controller.listAvgTime(req, res, next));

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
  router.get('/:id', authMiddleware, (req, res, next) => controller.getById(req, res, next));

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
  router.post('/', authMiddleware, requireRole('admin'), (req, res, next) => controller.create(req, res, next));

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
  router.put('/:id', authMiddleware, requireRole('admin'), (req, res, next) => controller.update(req, res, next));

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
  router.delete('/:id', authMiddleware, requireRole('admin'), (req, res, next) => controller.delete(req, res, next));

  return router;
}
