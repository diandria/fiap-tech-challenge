import { Router } from 'express';
import { CustomerController } from '../../../adapters/controllers/CustomerController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';

export function customerRoutes(controller: CustomerController): Router {
  const router = Router();
  router.use(authMiddleware);
  router.use(requireRole('attendant', 'admin'));

  /**
   * @openapi
   * /customers:
   *   get:
   *     summary: List all customers
   *     tags: [Customers]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Array of customers
   */
  router.get('/', (req, res, next) => controller.list(req, res, next));

  /**
   * @openapi
   * /customers:
   *   post:
   *     summary: Create a customer
   *     tags: [Customers]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, taxId, email, phone]
   *             properties:
   *               name: { type: string }
   *               taxId: { type: string }
   *               email: { type: string }
   *               phone: { type: string }
   *               taxType: { type: string, enum: [CPF, CNPJ] }
   *     responses:
   *       201:
   *         description: Created customer
   *       400:
   *         description: Invalid CPF/CNPJ
   *       409:
   *         description: CPF/CNPJ already registered
   */
  router.post('/', (req, res, next) => controller.create(req, res, next));

  /**
   * @openapi
   * /customers/tax/{taxId}:
   *   get:
   *     summary: Get a customer by CPF or CNPJ
   *     tags: [Customers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: taxId
   *         required: true
   *         schema: { type: string }
   *         description: CPF (11 digits) or CNPJ (14 digits), formatted or raw
   *     responses:
   *       200:
   *         description: Customer object
   *       404:
   *         description: Not found
   */
  router.get('/tax/:taxId', (req, res, next) => controller.getByTaxId(req, res, next));

  /**
   * @openapi
   * /customers/{id}:
   *   get:
   *     summary: Get a customer by ID
   *     tags: [Customers]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Customer object
   *       404:
   *         description: Not found
   */
  router.get('/:id', (req, res, next) => controller.getById(req, res, next));

  /**
   * @openapi
   * /customers/{id}:
   *   put:
   *     summary: Update a customer
   *     tags: [Customers]
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
   *               email: { type: string }
   *               phone: { type: string }
   *     responses:
   *       200:
   *         description: Updated customer
   *       404:
   *         description: Not found
   */
  router.put('/:id', (req, res, next) => controller.update(req, res, next));

  /**
   * @openapi
   * /customers/{id}:
   *   delete:
   *     summary: Delete a customer
   *     tags: [Customers]
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
