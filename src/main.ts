import 'dotenv/config';
import { createApp } from './app';
import { connectDB, disconnectDB } from './frameworks/database/connection';
import { seedDefaultAdmin } from './frameworks/database/seed';

import { MongoCustomerRepository } from './adapters/gateways/MongoCustomerRepository';
import { MongoVehicleRepository } from './adapters/gateways/MongoVehicleRepository';
import { MongoServiceRepository } from './adapters/gateways/MongoServiceRepository';
import { MongoItemRepository } from './adapters/gateways/MongoItemRepository';
import { MongoServiceOrderRepository } from './adapters/gateways/MongoServiceOrderRepository';
import { MongoUserRepository } from './adapters/gateways/MongoUserRepository';
import { ConsoleNotificationService } from './adapters/services/ConsoleNotificationService';

import { LoginUseCase } from './use-cases/auth/LoginUseCase';
import { RegisterUseCase } from './use-cases/auth/RegisterUseCase';
import { CreateCustomerUseCase } from './use-cases/customers/CreateCustomerUseCase';
import { GetCustomerByIdUseCase } from './use-cases/customers/GetCustomerByIdUseCase';
import { GetCustomerByTaxIdUseCase } from './use-cases/customers/GetCustomerByTaxIdUseCase';
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
import { CalculateBudgetUseCase } from './use-cases/service-orders/CalculateBudgetUseCase';
import { CreateServiceOrderUseCase } from './use-cases/service-orders/CreateServiceOrderUseCase';
import { GetServiceOrderUseCase } from './use-cases/service-orders/GetServiceOrderUseCase';
import { ListServiceOrdersUseCase } from './use-cases/service-orders/ListServiceOrdersUseCase';
import { AddServiceToOSUseCase } from './use-cases/service-orders/AddServiceToOSUseCase';
import { RemoveServiceFromOSUseCase } from './use-cases/service-orders/RemoveServiceFromOSUseCase';
import { AddItemToOSUseCase } from './use-cases/service-orders/AddItemToOSUseCase';
import { RemoveItemFromOSUseCase } from './use-cases/service-orders/RemoveItemFromOSUseCase';
import { NotifyStatusChangeUseCase } from './use-cases/service-orders/NotifyStatusChangeUseCase';
import { NotifyBudgetUseCase } from './use-cases/service-orders/NotifyBudgetUseCase';
import { StartDiagnosisUseCase } from './use-cases/service-orders/StartDiagnosisUseCase';
import { FinishDiagnosisUseCase } from './use-cases/service-orders/FinishDiagnosisUseCase';
import { ApproveBudgetUseCase } from './use-cases/service-orders/ApproveBudgetUseCase';
import { RejectBudgetUseCase } from './use-cases/service-orders/RejectBudgetUseCase';
import { StartExecutionUseCase } from './use-cases/service-orders/StartExecutionUseCase';
import { StartServiceUseCase } from './use-cases/service-orders/StartServiceUseCase';
import { FinishServiceUseCase } from './use-cases/service-orders/FinishServiceUseCase';
import { FinishOSUseCase } from './use-cases/service-orders/FinishOSUseCase';
import { DeliverOSUseCase } from './use-cases/service-orders/DeliverOSUseCase';
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

const PORT = process.env.PORT ?? 3000;
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/car-repair-shop';

async function main(): Promise<void> {
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
  const notifyStatusChange = new NotifyStatusChangeUseCase(osRepo, customerRepo, notifier);
  const notifyBudget = new NotifyBudgetUseCase(osRepo, customerRepo, notifier);

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

  const app = createApp({
    auth: authRoutes(authController),
    customers: customerRoutes(customerController),
    vehicles: vehicleRoutes(vehicleController),
    services: serviceRoutes(serviceController),
    items: itemRoutes(itemController),
    serviceOrders: serviceOrderRoutes(osController),
  });

  // HTTP server starts before DB connects so health probes are reachable during startup
  const server = app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
  process.on('SIGTERM', async () => { server.close(); await disconnectDB(); process.exit(0); });

  await connectDB(MONGODB_URI);
  await seedDefaultAdmin();
}

main().catch((err) => { console.error(err); process.exit(1); });
