import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';
import path from 'path';

// __dirname resolves to src/infrastructure/swagger (dev) or dist/infrastructure/swagger (prod).
// Both contain the same relative path to the route files.
const routesGlob = path.join(__dirname, '../http/routes/*.{ts,js}');

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Car Repair Shop API',
      version: '1.0.0',
      description: `REST API for managing service orders, customers, vehicles, services, and inventory for a car repair shop.

## Getting started

A default admin user is created automatically on first startup:

| Field    | Value             |
|----------|-------------------|
| email    | \`admin@master.com\` |
| password | \`admin\`           |

### How to authenticate

1. Expand **POST /auth/login** below, click **Try it out**, and send the credentials above.
2. Copy the \`token\` from the response.
3. Click the **Authorize** button (🔒 top-right), paste the token — **without** the \`Bearer \` prefix — and click **Authorize**.

All protected endpoints will now include the JWT automatically.

> Public endpoints (no token required):
> - \`GET /service-orders/{id}/status\` — check OS status and budget total.
> - \`PATCH /service-orders/{id}/budget\` with body \`{"status":"APPROVED","code":"5299"}\` or \`{"status":"REJECTED","code":"5299"}\` — customer-facing budget approval/rejection (rate-limited; \`code\` = first 4 digits of CPF/CNPJ).
> All other OS transitions go through \`PATCH /service-orders/{id}\` with the target \`status\` in the body and require a JWT with role \`mechanic\` or \`admin\`.`,
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
