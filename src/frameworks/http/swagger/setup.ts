import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';
import path from 'path';

// __dirname resolves to src/infrastructure/swagger (dev) or dist/infrastructure/swagger (prod).
// Both contain the same relative path to the route files.
const routesGlob = path.join(__dirname, '../../../infrastructure/http/routes/*.{ts,js}');

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Car Repair Shop API',
      version: '1.0.0',
      description: `REST API for managing service orders, customers, vehicles, services, and inventory for a car repair shop.

## Authentication

On first startup the API seeds a default admin user using the \`ADMIN_EMAIL\` and \`ADMIN_PASSWORD\` environment variables. Refer to your deployment configuration for the active credentials.

1. Call **POST /auth/login** with valid credentials.
2. Copy the \`token\` from the response.
3. Click **Authorize** (top-right), paste the token (without the \`Bearer \` prefix) and confirm.

Protected endpoints will then send the JWT automatically.

## Public endpoints (no token required)

- \`GET /service-orders/{id}/status\` — check OS status and budget total.
- \`PATCH /service-orders/{id}/budget\` — customer-facing budget approval or rejection. Rate-limited; the \`code\` field corresponds to the first 4 digits of the customer's CPF/CNPJ.

All other OS transitions go through \`PATCH /service-orders/{id}\` with the target \`status\` in the body and require a JWT with role \`mechanic\` or \`admin\`.`,
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [routesGlob],
};

export function setupSwagger(app: Application): void {
  const spec = swaggerJsdoc(options);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
}
