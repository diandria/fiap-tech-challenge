import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Application } from 'express';
import { createApp } from '../../src/app';

import { MongoCustomerRepository } from '../../src/adapters/gateways/MongoCustomerRepository';
import { MongoVehicleRepository } from '../../src/adapters/gateways/MongoVehicleRepository';
import { MongoServiceRepository } from '../../src/adapters/gateways/MongoServiceRepository';
import { MongoItemRepository } from '../../src/adapters/gateways/MongoItemRepository';
import { MongoServiceOrderRepository } from '../../src/adapters/gateways/MongoServiceOrderRepository';
import { MongoUserRepository } from '../../src/adapters/gateways/MongoUserRepository';
import { ConsoleNotificationService } from '../../src/adapters/services/ConsoleNotificationService';

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

let mongoServer: MongoMemoryServer;

export async function connectTestDB(): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}

export async function disconnectTestDB(): Promise<void> {
  await mongoose.disconnect();
  await mongoServer.stop();
}

export async function clearTestDB(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

export function createTestApp(): Application {
  const customerRepo = new MongoCustomerRepository();
  const vehicleRepo = new MongoVehicleRepository();
  const serviceRepo = new MongoServiceRepository();
  const itemRepo = new MongoItemRepository();
  const osRepo = new MongoServiceOrderRepository();
  const userRepo = new MongoUserRepository();
  const notifier = new ConsoleNotificationService();

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
  const osController = new ServiceOrderController(
    new CreateServiceOrderUseCase(osRepo, serviceRepo, itemRepo), new GetServiceOrderUseCase(osRepo),
    new ListServiceOrdersUseCase(osRepo),
    new AddServiceToOSUseCase(osRepo, serviceRepo), new RemoveServiceFromOSUseCase(osRepo),
    new AddItemToOSUseCase(osRepo, itemRepo), new RemoveItemFromOSUseCase(osRepo, itemRepo),
    new StartDiagnosisUseCase(osRepo),
    new FinishDiagnosisUseCase(osRepo, serviceRepo, itemRepo, customerRepo, notifier),
    new ApproveBudgetUseCase(osRepo, customerRepo),
    new RejectBudgetUseCase(osRepo, customerRepo, itemRepo),
    new StartExecutionUseCase(osRepo, itemRepo),
    new StartServiceUseCase(osRepo), new FinishServiceUseCase(osRepo),
    new FinishOSUseCase(osRepo), new DeliverOSUseCase(osRepo),
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
