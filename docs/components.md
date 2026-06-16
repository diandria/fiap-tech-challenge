# Component Catalogue

Structured inventory of every named component in the codebase, organized by Clean Architecture layer.

## Layer 1 — Entities (`src/entities/`)

| File | Type | Purpose |
|---|---|---|
| `ServiceOrder.ts` | Interface + types | OS aggregate root; holds status, services, items, timestamps |
| `Customer.ts` | Interface | Customer data including confirmation code |
| `Vehicle.ts` | Interface | Vehicle linked to a customer |
| `Item.ts` | Interface + function | Stock item; `getAvailableQuantity()` computes free stock |
| `Service.ts` | Interface | Labour service with price |
| `User.ts` | Interface + enum | System user with `UserRole` (ADMIN, MECHANIC, ATTENDANT) |
| `serviceOrderStateMachine.ts` | Functions | `canTransition` / `assertTransition` enforce valid OS state changes |
| `validators.ts` | Functions | Domain-level field validators |
| `errors/AppError.ts` | Classes | `AppError`, `NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError` |

## Layer 2 — Use Cases (`src/use-cases/`)

### Service Order use cases (`service-orders/`)

| Class | Trigger | Description |
|---|---|---|
| `CreateServiceOrderUseCase` | Attendant | Opens a new OS for a customer + vehicle |
| `GetServiceOrderUseCase` | Any role | Returns a single OS by ID |
| `ListServiceOrdersUseCase` | Any role | Returns all OSs (optionally filtered by status) |
| `StartDiagnosisUseCase` | Mechanic | Transitions OS: RECEIVED → DIAGNOSIS |
| `AddServiceToOSUseCase` | Mechanic | Adds a catalogue service to the OS during DIAGNOSIS |
| `RemoveServiceFromOSUseCase` | Mechanic | Removes a service from the OS during DIAGNOSIS |
| `AddItemToOSUseCase` | Mechanic | Adds a stock item to the OS; reserves stock |
| `RemoveItemFromOSUseCase` | Mechanic | Removes an item from the OS; releases stock |
| `FinishDiagnosisUseCase` | Mechanic | Computes `budgetTotal`; transitions to WAITING_APPROVAL; notifies customer |
| `ApproveBudgetUseCase` | Customer | Validates confirmation code; transitions to APPROVED |
| `RejectBudgetUseCase` | Customer | Transitions OS: WAITING_APPROVAL → REJECTED |
| `StartExecutionUseCase` | Mechanic | Transitions OS: APPROVED → EXECUTION |
| `StartServiceUseCase` | Mechanic | Records `startedAt` on an individual OSService |
| `FinishServiceUseCase` | Mechanic | Records `finishedAt` on an individual OSService |
| `FinishOSUseCase` | Mechanic | Transitions OS: EXECUTION → FINISHED |
| `DeliverOSUseCase` | Attendant | Transitions OS: FINISHED → DELIVERED |
| `GetAvgExecutionTimeUseCase` | Any role | Returns average execution time per service catalogue entry |

### Notification use cases (`service-orders/`)

| Class | Method | Description |
|---|---|---|
| `NotifyStatusChangeUseCase` | `execute({ osId })` | Sends a status-change notification to the customer; best-effort |
| `NotifyBudgetUseCase` | `execute({ osId })` | Sends the computed budget to the customer; best-effort |

### Other use case modules

| Module | Use Cases |
|---|---|
| `auth/` | `LoginUseCase` |
| `customers/` | `CreateCustomerUseCase`, `GetCustomerUseCase`, `ListCustomersUseCase`, `UpdateCustomerUseCase`, `DeleteCustomerUseCase` |
| `items/` | `CreateItemUseCase`, `GetItemUseCase`, `ListItemsUseCase`, `UpdateItemUseCase`, `DeleteItemUseCase` |
| `services/` | `CreateServiceUseCase`, `GetServiceUseCase`, `ListServicesUseCase`, `UpdateServiceUseCase`, `DeleteServiceUseCase` |
| `vehicles/` | `CreateVehicleUseCase`, `GetVehicleUseCase`, `ListVehiclesUseCase`, `UpdateVehicleUseCase`, `DeleteVehicleUseCase` |

### Ports (`use-cases/ports/`)

| Interface | Implemented by |
|---|---|
| `IServiceOrderRepository` | `MongoServiceOrderRepository` |
| `ICustomerRepository` | `MongoCustomerRepository` |
| `IItemRepository` | `MongoItemRepository` |
| `IServiceRepository` | `MongoServiceRepository` |
| `IVehicleRepository` | `MongoVehicleRepository` |
| `IUserRepository` | `MongoUserRepository` |
| `INotificationService` | `ConsoleNotificationService` |

## Layer 3 — Interface Adapters (`src/adapters/`)

### Controllers (`adapters/controllers/`)

| Class | Routes |
|---|---|
| `AuthController` | `POST /auth/login` |
| `CustomerController` | `GET/POST /customers`, `GET/PUT/DELETE /customers/:id` |
| `VehicleController` | `GET/POST /vehicles`, `GET/PUT/DELETE /vehicles/:id` |
| `ItemController` | `GET/POST /items`, `GET/PUT/DELETE /items/:id` |
| `ServiceController` | `GET/POST /services`, `GET/PUT/DELETE /services/:id`, `GET /services/avg-time` |
| `ServiceOrderController` | Full OS lifecycle + item/service management endpoints |

### Gateways / Repositories (`adapters/gateways/`)

| Class | Port implemented |
|---|---|
| `MongoServiceOrderRepository` | `IServiceOrderRepository` |
| `MongoCustomerRepository` | `ICustomerRepository` |
| `MongoItemRepository` | `IItemRepository` |
| `MongoServiceRepository` | `IServiceRepository` |
| `MongoVehicleRepository` | `IVehicleRepository` |
| `MongoUserRepository` | `IUserRepository` |

### Services (`adapters/services/`)

| Class | Port implemented |
|---|---|
| `ConsoleNotificationService` | `INotificationService` |

## Layer 4 — Frameworks & Drivers (`src/frameworks/`)

| Component | File | Role |
|---|---|---|
| Express application factory | `app.ts` | Wires middleware, routes, and error handler |
| Entry point | `main.ts` | Connects to MongoDB then starts Express |
| Route files | `frameworks/http/routes/` | Map HTTP verbs + paths to controller methods |
| Auth middleware | `frameworks/http/middlewares/authMiddleware.ts` | JWT verification; injects `req.user` |
| Error handler | `frameworks/http/middlewares/errorHandler.ts` | Converts `AppError` subclasses to HTTP status codes |
| MongoDB connection | `frameworks/database/` | Mongoose connection setup |
| OpenAPI / Swagger | integrated via `swagger-jsdoc` + `swagger-ui-express` | `GET /api-docs` |
