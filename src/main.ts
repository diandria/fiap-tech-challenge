import 'dotenv/config';
// First runtime import: auto-instrumentation has to monkey-patch http, express
// and pg before those modules load.
import './frameworks/tracing/start';
import { createApp } from './app';
import { prisma, disconnectPrisma } from './frameworks/database/prismaClient';
import { databaseReadiness } from './frameworks/database/readinessProbe';
import { logger } from './frameworks/logging/logger';
import { PinoLoggerAdapter } from './adapters/logging/PinoLoggerAdapter';
import { seedDefaultAdmin } from './frameworks/database/seed';

import { PostgresCustomerRepository } from './adapters/gateways/PostgresCustomerRepository';
import { PostgresVehicleRepository } from './adapters/gateways/PostgresVehicleRepository';
import { PostgresServiceRepository } from './adapters/gateways/PostgresServiceRepository';
import { PostgresItemRepository } from './adapters/gateways/PostgresItemRepository';
import { PostgresServiceOrderRepository } from './adapters/gateways/PostgresServiceOrderRepository';
import { PostgresUserRepository } from './adapters/gateways/PostgresUserRepository';
import { PrismaUnitOfWork } from './adapters/gateways/PrismaUnitOfWork';
import { AsyncLocalStorageTraceContext } from './frameworks/logging/AsyncLocalStorageTraceContext';
import { createNotificationService } from './frameworks/notifications/notificationFactory';

import { LoginUseCase } from './use-cases/auth/LoginUseCase';
import { RegisterUseCase } from './use-cases/auth/RegisterUseCase';
import { CreateCustomerUseCase } from './use-cases/customers/CreateCustomerUseCase';
import { GetCustomerByIdUseCase } from './use-cases/customers/GetCustomerByIdUseCase';
import { GetCustomerByTaxIdUseCase } from './use-cases/customers/GetCustomerByTaxIdUseCase';
import { LookupCustomerByCpfUseCase } from './use-cases/customers/LookupCustomerByCpfUseCase';
import { ListCustomersUseCase } from './use-cases/customers/ListCustomersUseCase';
import { UpdateCustomerUseCase } from './use-cases/customers/UpdateCustomerUseCase';
import { DeleteCustomerUseCase } from './use-cases/customers/DeleteCustomerUseCase';
import { CreateVehicleUseCase } from './use-cases/vehicles/CreateVehicleUseCase';
import { GetVehicleByIdUseCase } from './use-cases/vehicles/GetVehicleByIdUseCase';
import { ListCustomerVehiclesUseCase } from './use-cases/vehicles/ListCustomerVehiclesUseCase';
import { UpdateVehicleUseCase } from './use-cases/vehicles/UpdateVehicleUseCase';
import { DeleteVehicleUseCase } from './use-cases/vehicles/DeleteVehicleUseCase';
import { CreateServiceUseCase } from './use-cases/services/CreateServiceUseCase';
import { GetServiceByIdUseCase } from './use-cases/services/GetServiceByIdUseCase';
import { ListServicesUseCase } from './use-cases/services/ListServicesUseCase';
import { ListServicesAvgTimeUseCase } from './use-cases/services/ListServicesAvgTimeUseCase';
import { UpdateServiceUseCase } from './use-cases/services/UpdateServiceUseCase';
import { DeleteServiceUseCase } from './use-cases/services/DeleteServiceUseCase';
import { CreateItemUseCase } from './use-cases/items/CreateItemUseCase';
import { GetItemByIdUseCase } from './use-cases/items/GetItemByIdUseCase';
import { ListItemsUseCase } from './use-cases/items/ListItemsUseCase';
import { UpdateItemUseCase } from './use-cases/items/UpdateItemUseCase';
import { DeleteItemUseCase } from './use-cases/items/DeleteItemUseCase';
import { CreateServiceOrderUseCase } from './use-cases/service-orders/CreateServiceOrderUseCase';
import { GetServiceOrderUseCase } from './use-cases/service-orders/GetServiceOrderUseCase';
import { ListServiceOrdersUseCase } from './use-cases/service-orders/ListServiceOrdersUseCase';
import { AddServiceToOSUseCase } from './use-cases/service-orders/AddServiceToOSUseCase';
import { RemoveServiceFromOSUseCase } from './use-cases/service-orders/RemoveServiceFromOSUseCase';
import { AddItemToOSUseCase } from './use-cases/service-orders/AddItemToOSUseCase';
import { RemoveItemFromOSUseCase } from './use-cases/service-orders/RemoveItemFromOSUseCase';
import { NotifyStatusChangeUseCase } from './use-cases/service-orders/NotifyStatusChangeUseCase';
import { ApproveBudgetUseCase } from './use-cases/service-orders/ApproveBudgetUseCase';
import { RejectBudgetUseCase } from './use-cases/service-orders/RejectBudgetUseCase';
import { StartServiceUseCase } from './use-cases/service-orders/StartServiceUseCase';
import { FinishServiceUseCase } from './use-cases/service-orders/FinishServiceUseCase';
import { DeliverOSUseCase } from './use-cases/service-orders/DeliverOSUseCase';
import { GetServiceOrderHistoryUseCase } from './use-cases/service-orders/GetServiceOrderHistoryUseCase';
import { GetAvgExecutionTimeUseCase } from './use-cases/service-orders/GetAvgExecutionTimeUseCase';

import { AuthController } from './adapters/controllers/AuthController';
import { CustomerController } from './adapters/controllers/CustomerController';
import { VehicleController } from './adapters/controllers/VehicleController';
import { ServiceController } from './adapters/controllers/ServiceController';
import { ItemController } from './adapters/controllers/ItemController';
import { ServiceOrderController } from './adapters/controllers/ServiceOrderController';

import { authRoutes } from './frameworks/http/routes/authRoutes';
import { customerRoutes } from './frameworks/http/routes/customerRoutes';
import { vehicleRoutes } from './frameworks/http/routes/vehicleRoutes';
import { serviceRoutes } from './frameworks/http/routes/serviceRoutes';
import { itemRoutes } from './frameworks/http/routes/itemRoutes';
import { serviceOrderRoutes } from './frameworks/http/routes/serviceOrderRoutes';
import { MeasuredCreateServiceOrder } from './adapters/decorators/MeasuredCreateServiceOrder';
import { PrometheusBusinessMetrics } from './frameworks/metrics/PrometheusBusinessMetrics';
import { MeasuredStatusTransition } from './adapters/decorators/MeasuredStatusTransition';
import { MeasuredBudgetDecision } from './adapters/decorators/MeasuredBudgetDecision';
import { MeasuredServiceOrderSaga } from './adapters/decorators/MeasuredServiceOrderSaga';
import { PrometheusSagaMetrics } from './frameworks/metrics/PrometheusSagaMetrics';
import { ServiceOrderSaga } from './use-cases/saga/ServiceOrderSaga';
import { createSagaMessaging } from './frameworks/messaging/messagingFactory';

const PORT = process.env.PORT ?? 3000;


async function main(): Promise<void> {
  const customerRepo = new PostgresCustomerRepository(prisma);
  const vehicleRepo = new PostgresVehicleRepository(prisma);
  const serviceRepo = new PostgresServiceRepository(prisma);
  const itemRepo = new PostgresItemRepository(prisma);
  const osRepo = new PostgresServiceOrderRepository(prisma);
  const userRepo = new PostgresUserRepository(prisma);
  const unitOfWork = new PrismaUnitOfWork(prisma, new AsyncLocalStorageTraceContext());
  const notifier = createNotificationService();
  const appLogger = new PinoLoggerAdapter(logger);

  const authController = new AuthController(
    new LoginUseCase(userRepo),
    new RegisterUseCase(userRepo),
    new LookupCustomerByCpfUseCase(customerRepo),
  );
  const customerController = new CustomerController(
    new CreateCustomerUseCase(customerRepo), new GetCustomerByIdUseCase(customerRepo),
    new GetCustomerByTaxIdUseCase(customerRepo), new ListCustomersUseCase(customerRepo),
    new UpdateCustomerUseCase(customerRepo), new DeleteCustomerUseCase(customerRepo),
  );
  const vehicleController = new VehicleController(
    new CreateVehicleUseCase(vehicleRepo), new GetVehicleByIdUseCase(vehicleRepo),
    new ListCustomerVehiclesUseCase(vehicleRepo), new UpdateVehicleUseCase(vehicleRepo),
    new DeleteVehicleUseCase(vehicleRepo),
  );
  const serviceController = new ServiceController(
    new CreateServiceUseCase(serviceRepo), new GetServiceByIdUseCase(serviceRepo),
    new ListServicesUseCase(serviceRepo), new ListServicesAvgTimeUseCase(serviceRepo),
    new UpdateServiceUseCase(serviceRepo), new DeleteServiceUseCase(serviceRepo),
  );
  const itemController = new ItemController(
    new CreateItemUseCase(itemRepo), new GetItemByIdUseCase(itemRepo),
    new ListItemsUseCase(itemRepo), new UpdateItemUseCase(itemRepo), new DeleteItemUseCase(itemRepo),
  );
  const notifyStatusChange = new NotifyStatusChangeUseCase(osRepo, customerRepo, notifier, appLogger);

  const businessMetrics = new PrometheusBusinessMetrics();

  const osController = new ServiceOrderController(
    new MeasuredCreateServiceOrder(
      new CreateServiceOrderUseCase(unitOfWork, serviceRepo),
      businessMetrics,
    ),
    new GetServiceOrderUseCase(osRepo),
    new ListServiceOrdersUseCase(osRepo),
    new AddServiceToOSUseCase(osRepo, serviceRepo), new RemoveServiceFromOSUseCase(osRepo),
    new AddItemToOSUseCase(unitOfWork), new RemoveItemFromOSUseCase(unitOfWork),
    new MeasuredBudgetDecision(new ApproveBudgetUseCase(osRepo, customerRepo, notifyStatusChange), businessMetrics),
    new MeasuredBudgetDecision(
      new RejectBudgetUseCase(osRepo, customerRepo, itemRepo, notifyStatusChange),
      businessMetrics,
    ),
    new StartServiceUseCase(osRepo), new FinishServiceUseCase(osRepo),
    new MeasuredStatusTransition(new DeliverOSUseCase(osRepo, notifyStatusChange), businessMetrics),
    new GetAvgExecutionTimeUseCase(osRepo),
    new GetServiceOrderHistoryUseCase(osRepo),
  );

  const app = createApp({
    auth: authRoutes(authController),
    customers: customerRoutes(customerController),
    vehicles: vehicleRoutes(vehicleController),
    services: serviceRoutes(serviceController),
    items: itemRoutes(itemController),
    serviceOrders: serviceOrderRoutes(osController),
  }, databaseReadiness(prisma));

  const saga = new MeasuredServiceOrderSaga(
    new ServiceOrderSaga(unitOfWork, serviceRepo, customerRepo, notifyStatusChange, appLogger),
    new PrometheusSagaMetrics(),
    businessMetrics,
  );
  const messaging = createSagaMessaging({ prisma, saga, logger });

  // HTTP server starts before DB connects so health probes are reachable during startup
  const server = app.listen(PORT, () => { logger.info({ port: PORT }, 'server started'); });
  // Stop taking messages first, so none is cut halfway; then drain in-flight
  // requests so rollouts don't reset client connections. The force-exit
  // fallback stays inside the 30s grace period.
  process.on('SIGTERM', async () => {
    setTimeout(() => process.exit(1), 25_000).unref();
    await messaging?.stop();
    server.close(async () => { await disconnectPrisma(); process.exit(0); });
  });

  await prisma.$connect();
  await seedDefaultAdmin(userRepo);
  messaging?.start();
}

main().catch((err) => { logger.error({ err }, 'fatal error during startup'); process.exit(1); });
