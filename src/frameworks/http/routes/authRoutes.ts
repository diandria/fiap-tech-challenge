import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../../../adapters/controllers/AuthController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';
import { internalTokenMiddleware } from '../middlewares/internalTokenMiddleware';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later' },
});

// Stricter limit than login: the only expected caller is the auth function,
// which makes one lookup per authentication.
const lookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many lookup attempts, please try again later' },
});

export function authRoutes(controller: AuthController): Router {
  const router = Router();

  // Internal route, consumed by the token-issuing function (ADR-002).
  // Intentionally left out of the public Swagger spec.
  router.post(
    '/customers/lookup',
    lookupLimiter,
    internalTokenMiddleware,
    (req, res, next) => controller.lookupCustomer(req, res, next),
  );

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
  router.post('/login', loginLimiter, (req, res, next) => controller.login(req, res, next));

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
  router.post('/register', authMiddleware, requireRole('admin'), (req, res, next) => controller.register(req, res, next));

  return router;
}
