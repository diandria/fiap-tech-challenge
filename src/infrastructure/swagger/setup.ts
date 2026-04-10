import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';

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
  apis: ['./src/infrastructure/http/routes/*.ts'],
};

export function setupSwagger(app: Application): void {
  const spec = swaggerJsdoc(options);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
}
