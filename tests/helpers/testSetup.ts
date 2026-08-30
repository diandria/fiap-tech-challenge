import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { Application } from 'express';
import { createApp } from '../../src/app';

import { PostgresCustomerRepository } from '../../src/adapters/gateways/PostgresCustomerRepository';
import { PostgresVehicleRepository } from '../../src/adapters/gateways/PostgresVehicleRepository';
import { PostgresServiceRepository } from '../../src/adapters/gateways/PostgresServiceRepository';
import { PostgresItemRepository } from '../../src/adapters/gateways/PostgresItemRepository';
import { PostgresServiceOrderRepository } from '../../src/adapters/gateways/PostgresServiceOrderRepository';
import { PostgresUserRepository } from '../../src/adapters/gateways/PostgresUserRepository';
import { ConsoleNotificationService } from '../../src/adapters/services/ConsoleNotificationService';
import { PinoLoggerAdapter } from '../../src/adapters/logging/PinoLoggerAdapter';
import { logger } from '../../src/frameworks/logging/logger';

import { LoginUseCase } from '../../src/use-cases/auth/LoginUseCase';
import { RegisterUseCase } from '../../src/use-cases/auth/RegisterUseCase';
import { CreateCustomerUseCase } from '../../src/use-cases/customers/CreateCustomerUseCase';
import { GetCustomerByIdUseCase } from '../../src/use-cases/customers/GetCustomerByIdUseCase';
import { GetCustomerByTaxIdUseCase } from '../../src/use-cases/customers/GetCustomerByTaxIdUseCase';
import { ListCustomersUseCase } from '../../src/use-cases/customers/ListCustomersUseCase';
import { UpdateCustomerUseCase } from '../../src/use-cases/customers/UpdateCustomerUseCase';
import { DeleteCustomerUseCase } from '../../src/use-cases/customers/DeleteCustomerUseCase';
import { CreateVehicleUseCase } from '../../src/use-cases/vehicles/CreateVehicleUseCase';
import { GetVehicleByIdUseCase } from '../../src/use-cases/vehicles/GetVehicleByIdUseCase';
import { ListCustomerVehiclesUseCase } from '../../src/use-cases/vehicles/ListCustomerVehiclesUseCase';
import { UpdateVehicleUseCase } from '../../src/use-cases/vehicles/UpdateVehicleUseCase';
import { DeleteVehicleUseCase } from '../../src/use-cases/vehicles/DeleteVehicleUseCase';
import { CreateServiceUseCase } from '../../src/use-cases/services/CreateServiceUseCase';
import { GetServiceByIdUseCase } from '../../src/use-cases/services/GetServiceByIdUseCase';
import { ListServicesUseCase } from '../../src/use-cases/services/ListServicesUseCase';
import { ListServicesAvgTimeUseCase } from '../../src/use-cases/services/ListServicesAvgTimeUseCase';
import { UpdateServiceUseCase } from '../../src/use-cases/services/UpdateServiceUseCase';
import { DeleteServiceUseCase } from '../../src/use-cases/services/DeleteServiceUseCase';
import { CreateItemUseCase } from '../../src/use-cases/items/CreateItemUseCase';
import { GetItemByIdUseCase } from '../../src/use-cases/items/GetItemByIdUseCase';
import { ListItemsUseCase } from '../../src/use-cases/items/ListItemsUseCase';
import { UpdateItemUseCase } from '../../src/use-cases/items/UpdateItemUseCase';
import { DeleteItemUseCase } from '../../src/use-cases/items/DeleteItemUseCase';
import { CreateServiceOrderUseCase } from '../../src/use-cases/service-orders/CreateServiceOrderUseCase';
import { GetServiceOrderUseCase } from '../../src/use-cases/service-orders/GetServiceOrderUseCase';
import { ListServiceOrdersUseCase } from '../../src/use-cases/service-orders/ListServiceOrdersUseCase';
import { AddServiceToOSUseCase } from '../../src/use-cases/service-orders/AddServiceToOSUseCase';
import { RemoveServiceFromOSUseCase } from '../../src/use-cases/service-orders/RemoveServiceFromOSUseCase';
import { AddItemToOSUseCase } from '../../src/use-cases/service-orders/AddItemToOSUseCase';
import { RemoveItemFromOSUseCase } from '../../src/use-cases/service-orders/RemoveItemFromOSUseCase';
import { CalculateBudgetUseCase } from '../../src/use-cases/service-orders/CalculateBudgetUseCase';
import { NotifyStatusChangeUseCase } from '../../src/use-cases/service-orders/NotifyStatusChangeUseCase';
import { NotifyBudgetUseCase } from '../../src/use-cases/service-orders/NotifyBudgetUseCase';
import { StartDiagnosisUseCase } from '../../src/use-cases/service-orders/StartDiagnosisUseCase';
import { FinishDiagnosisUseCase } from '../../src/use-cases/service-orders/FinishDiagnosisUseCase';
import { ApproveBudgetUseCase } from '../../src/use-cases/service-orders/ApproveBudgetUseCase';
import { RejectBudgetUseCase } from '../../src/use-cases/service-orders/RejectBudgetUseCase';
import { StartExecutionUseCase } from '../../src/use-cases/service-orders/StartExecutionUseCase';
import { StartServiceUseCase } from '../../src/use-cases/service-orders/StartServiceUseCase';
import { FinishServiceUseCase } from '../../src/use-cases/service-orders/FinishServiceUseCase';
import { FinishOSUseCase } from '../../src/use-cases/service-orders/FinishOSUseCase';
import { DeliverOSUseCase } from '../../src/use-cases/service-orders/DeliverOSUseCase';
import { GetAvgExecutionTimeUseCase } from '../../src/use-cases/service-orders/GetAvgExecutionTimeUseCase';

import { AuthController } from '../../src/adapters/controllers/AuthController';
import { CustomerController } from '../../src/adapters/controllers/CustomerController';
import { VehicleController } from '../../src/adapters/controllers/VehicleController';
import { ServiceController } from '../../src/adapters/controllers/ServiceController';
import { ItemController } from '../../src/adapters/controllers/ItemController';
import { ServiceOrderController } from '../../src/adapters/controllers/ServiceOrderController';

import { authRoutes } from '../../src/frameworks/http/routes/authRoutes';
import { customerRoutes } from '../../src/frameworks/http/routes/customerRoutes';
import { vehicleRoutes } from '../../src/frameworks/http/routes/vehicleRoutes';
import { serviceRoutes } from '../../src/frameworks/http/routes/serviceRoutes';
import { itemRoutes } from '../../src/frameworks/http/routes/itemRoutes';
import { serviceOrderRoutes } from '../../src/frameworks/http/routes/serviceOrderRoutes';

let container: StartedPostgreSqlContainer;
export let prisma: PrismaClient;

export async function connectTestDB(): Promise<void> {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env.DATABASE_URL = container.getConnectionUri();

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: container.getConnectionUri() },
    stdio: 'pipe',
  });

  prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
  await prisma.$connect();
}

export async function disconnectTestDB(): Promise<void> {
  await prisma?.$disconnect();
  await container?.stop();
}

export async function clearTestDB(): Promise<void> {
  // CASCADE respeita as chaves estrangeiras; sem ele o TRUNCATE falha por dependencia.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE service_order_items, service_order_services, service_orders,
                   vehicles, customers, items, services, users
    RESTART IDENTITY CASCADE
  `);
}

export function createTestApp(): Application {
  const customerRepo = new PostgresCustomerRepository(prisma);
  const vehicleRepo = new PostgresVehicleRepository(prisma);
  const serviceRepo = new PostgresServiceRepository(prisma);
  const itemRepo = new PostgresItemRepository(prisma);
  const osRepo = new PostgresServiceOrderRepository(prisma);
  const userRepo = new PostgresUserRepository(prisma);
  const notifier = new ConsoleNotificationService();
  const appLogger = new PinoLoggerAdapter(logger);

  const authController = new AuthController(new LoginUseCase(userRepo), new RegisterUseCase(userRepo));
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
  const notifyBudget = new NotifyBudgetUseCase(osRepo, customerRepo, notifier, appLogger);

  const osController = new ServiceOrderController(
    new CreateServiceOrderUseCase(osRepo, serviceRepo, itemRepo), new GetServiceOrderUseCase(osRepo),
    new ListServiceOrdersUseCase(osRepo),
    new AddServiceToOSUseCase(osRepo, serviceRepo), new RemoveServiceFromOSUseCase(osRepo),
    new AddItemToOSUseCase(osRepo, itemRepo), new RemoveItemFromOSUseCase(osRepo, itemRepo),
    new StartDiagnosisUseCase(osRepo, notifyStatusChange),
    new FinishDiagnosisUseCase(osRepo, notifyStatusChange, notifyBudget, new CalculateBudgetUseCase(serviceRepo, itemRepo)),
    new ApproveBudgetUseCase(osRepo, customerRepo, notifyStatusChange),
    new RejectBudgetUseCase(osRepo, customerRepo, itemRepo, notifyStatusChange),
    new StartExecutionUseCase(osRepo, itemRepo, notifyStatusChange),
    new StartServiceUseCase(osRepo), new FinishServiceUseCase(osRepo),
    new FinishOSUseCase(osRepo, notifyStatusChange), new DeliverOSUseCase(osRepo, notifyStatusChange),
    new GetAvgExecutionTimeUseCase(osRepo),
  );

  return createApp({
    auth: authRoutes(authController),
    customers: customerRoutes(customerController),
    vehicles: vehicleRoutes(vehicleController),
    services: serviceRoutes(serviceController),
    items: itemRoutes(itemController),
    serviceOrders: serviceOrderRoutes(osController),
  });
}
