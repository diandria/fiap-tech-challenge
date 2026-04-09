import { Router } from 'express';
import { MongoCustomerRepository } from '../../persistence/repositories/MongoCustomerRepository';
import { CreateCustomerUseCase } from '../../../application/use-cases/customers/CreateCustomerUseCase';
import { GetCustomerByIdUseCase } from '../../../application/use-cases/customers/GetCustomerByIdUseCase';
import { ListCustomersUseCase } from '../../../application/use-cases/customers/ListCustomersUseCase';
import { UpdateCustomerUseCase } from '../../../application/use-cases/customers/UpdateCustomerUseCase';
import { DeleteCustomerUseCase } from '../../../application/use-cases/customers/DeleteCustomerUseCase';
import { GetCustomerByTaxIdUseCase } from '../../../application/use-cases/customers/GetCustomerByTaxIdUseCase';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';

export function customerRoutes(): Router {
  const router = Router();
  const repo = new MongoCustomerRepository();
  const createCustomer = new CreateCustomerUseCase(repo);
  const getCustomerById = new GetCustomerByIdUseCase(repo);
  const listCustomers = new ListCustomersUseCase(repo);
  const updateCustomer = new UpdateCustomerUseCase(repo);
  const deleteCustomer = new DeleteCustomerUseCase(repo);
  const getCustomerByTaxId = new GetCustomerByTaxIdUseCase(repo);

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
  router.get('/', async (req, res, next) => {
    try {
      const customers = await listCustomers.execute();
      res.json(customers);
    } catch (err) { next(err); }
  });

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
  router.post('/', async (req, res, next) => {
    try {
      const customer = await createCustomer.execute(req.body);
      res.status(201).json(customer);
    } catch (err) { next(err); }
  });

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
  router.get('/tax/:taxId', async (req, res, next) => {
    try {
      const customer = await getCustomerByTaxId.execute(req.params.taxId);
      res.json(customer);
    } catch (err) { next(err); }
  });

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
  router.get('/:id', async (req, res, next) => {
    try {
      const customer = await getCustomerById.execute(req.params.id);
      res.json(customer);
    } catch (err) { next(err); }
  });

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
  router.put('/:id', async (req, res, next) => {
    try {
      const customer = await updateCustomer.execute(req.params.id, req.body);
      res.json(customer);
    } catch (err) { next(err); }
  });

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
  router.delete('/:id', async (req, res, next) => {
    try {
      await deleteCustomer.execute(req.params.id);
      res.sendStatus(204);
    } catch (err) { next(err); }
  });

  return router;
}
