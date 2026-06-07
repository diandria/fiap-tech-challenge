import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { MongoUserRepository } from '../../../adapters/gateways/MongoUserRepository';
import { LoginUseCase } from '../../../use-cases/auth/LoginUseCase';
import { RegisterUseCase } from '../../../use-cases/auth/RegisterUseCase';
import { authMiddleware } from '../../../frameworks/http/middlewares/authMiddleware';
import { requireRole } from '../../../frameworks/http/middlewares/roleMiddleware';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later' },
});

export function authRoutes(): Router {
  const router = Router();
  const repo = new MongoUserRepository();
  const loginUseCase = new LoginUseCase(repo);
  const registerUseCase = new RegisterUseCase(repo);

  /**
   * @openapi
   * /auth/login:
   *   post:
   *     summary: Authenticate and receive a JWT
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email: { type: string }
   *               password: { type: string }
   *     responses:
   *       200:
   *         description: JWT token
   *       401:
   *         description: Invalid credentials
   */
  router.post('/login', loginLimiter, async (req, res, next) => {
    try {
      const result = await loginUseCase.execute(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /**
   * @openapi
   * /auth/register:
   *   post:
   *     summary: Register a new user (admin only)
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password, role]
   *             properties:
   *               email: { type: string }
   *               password: { type: string }
   *               role: { type: string, enum: [attendant, mechanic, admin] }
   *     responses:
   *       201:
   *         description: Created user
   *       409:
   *         description: Email already in use
   */
  router.post('/register', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
      const user = await registerUseCase.execute(req.body);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
