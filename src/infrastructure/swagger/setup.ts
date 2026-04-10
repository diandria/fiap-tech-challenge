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
      description:
        'REST API for managing service orders, customers, vehicles, services, and inventory for a car repair shop.',
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
