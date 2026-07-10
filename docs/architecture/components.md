# Catálogo de Componentes

Inventário estruturado de todos os componentes nomeados do código, organizado por camada da Clean Architecture.

## Camada 1 — Entities (`src/entities/`)

| Arquivo | Tipo | Função |
|---|---|---|
| `ServiceOrder.ts` | Interface + tipos | Raiz do agregado OS; contém status, serviços, itens e timestamps |
| `Customer.ts` | Interface | Dados do cliente; o `taxId` é usado para derivar o código de aprovação do orçamento em tempo de execução |
| `Vehicle.ts` | Interface | Veículo vinculado a um cliente |
| `Item.ts` | Interface + função | Item de estoque; `getAvailableQuantity()` calcula o estoque livre |
| `Service.ts` | Interface | Serviço de mão de obra com preço |
| `User.ts` | Interface + enum | Usuário do sistema com `UserRole` (ADMIN, MECHANIC, ATTENDANT) |
| `serviceOrderStateMachine.ts` | Funções | `canTransition` / `assertTransition` garantem transições de estado válidas da OS |
| `validators.ts` | Funções | Validadores de campos no nível de domínio |
| `errors/AppError.ts` | Classes | `AppError`, `NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError` |

## Camada 2 — Use Cases (`src/use-cases/`)

### Use cases de Ordem de Serviço (`service-orders/`)

| Classe | Acionado por | Descrição |
|---|---|---|
| `CreateServiceOrderUseCase` | Atendente | Abre uma nova OS para um cliente + veículo |
| `GetServiceOrderUseCase` | Qualquer papel | Retorna uma OS pelo ID |
| `ListServiceOrdersUseCase` | Qualquer papel | Retorna todas as OS (com filtro opcional por status) |
| `StartDiagnosisUseCase` | Mecânico | Transição da OS: RECEIVED → DIAGNOSIS |
| `AddServiceToOSUseCase` | Mecânico | Adiciona um serviço do catálogo à OS durante o DIAGNOSIS |
| `RemoveServiceFromOSUseCase` | Mecânico | Remove um serviço da OS durante o DIAGNOSIS |
| `AddItemToOSUseCase` | Mecânico | Adiciona um item de estoque à OS; reserva estoque |
| `RemoveItemFromOSUseCase` | Mecânico | Remove um item da OS; libera a reserva de estoque |
| `FinishDiagnosisUseCase` | Mecânico | Calcula o `budgetTotal`; transiciona para WAITING_APPROVAL; notifica o cliente |
| `ApproveBudgetUseCase` | Cliente | Valida o código de confirmação; transiciona para APPROVED |
| `RejectBudgetUseCase` | Cliente | Transição da OS: WAITING_APPROVAL → REJECTED |
| `StartExecutionUseCase` | Mecânico | Transição da OS: APPROVED → EXECUTION |
| `StartServiceUseCase` | Mecânico | Registra `startedAt` em um OSService individual |
| `FinishServiceUseCase` | Mecânico | Registra `finishedAt` em um OSService individual |
| `FinishOSUseCase` | Mecânico | Transição da OS: EXECUTION → FINISHED |
| `DeliverOSUseCase` | Atendente | Transição da OS: FINISHED → DELIVERED |
| `GetAvgExecutionTimeUseCase` | Qualquer papel | Retorna o tempo médio de execução por serviço do catálogo |

### Use cases de notificação (`service-orders/`)

| Classe | Método | Descrição |
|---|---|---|
| `NotifyStatusChangeUseCase` | `execute({ osId })` | Envia notificação de mudança de status ao cliente; melhor esforço |
| `NotifyBudgetUseCase` | `execute({ osId })` | Envia o orçamento calculado ao cliente; melhor esforço |

### Demais módulos de use cases

| Módulo | Use Cases |
|---|---|
| `auth/` | `LoginUseCase`, `RegisterUseCase` |
| `customers/` | `CreateCustomerUseCase`, `GetCustomerUseCase`, `ListCustomersUseCase`, `UpdateCustomerUseCase`, `DeleteCustomerUseCase` |
| `items/` | `CreateItemUseCase`, `GetItemUseCase`, `ListItemsUseCase`, `UpdateItemUseCase`, `DeleteItemUseCase` |
| `services/` | `CreateServiceUseCase`, `GetServiceUseCase`, `ListServicesUseCase`, `ListServicesAvgTimeUseCase`, `UpdateServiceUseCase`, `DeleteServiceUseCase` |
| `vehicles/` | `CreateVehicleUseCase`, `GetVehicleUseCase`, `ListVehiclesUseCase`, `UpdateVehicleUseCase`, `DeleteVehicleUseCase` |

### Ports (`use-cases/ports/`)

| Interface | Implementada por |
|---|---|
| `IServiceOrderRepository` | `MongoServiceOrderRepository` |
| `ICustomerRepository` | `MongoCustomerRepository` |
| `IItemRepository` | `MongoItemRepository` |
| `IServiceRepository` | `MongoServiceRepository` |
| `IVehicleRepository` | `MongoVehicleRepository` |
| `IUserRepository` | `MongoUserRepository` |
| `INotificationService` | `ConsoleNotificationService` |

## Camada 3 — Interface Adapters (`src/adapters/`)

### Controllers (`adapters/controllers/`)

| Classe | Rotas |
|---|---|
| `AuthController` | `POST /auth/login`, `POST /auth/register` (admin) |
| `CustomerController` | `GET/POST /customers`, `GET/PUT/DELETE /customers/:id` |
| `VehicleController` | `GET/POST /vehicles`, `GET/PUT/DELETE /vehicles/:id` |
| `ItemController` | `GET/POST /items`, `GET/PUT/DELETE /items/:id` |
| `ServiceController` | `GET/POST /services`, `GET/PUT/DELETE /services/:id`, `GET /services/avg-time` |
| `ServiceOrderController` | Ciclo de vida completo da OS + endpoints de gestão de itens/serviços |

### Gateways / Repositórios (`adapters/gateways/`)

| Classe | Port implementada |
|---|---|
| `MongoServiceOrderRepository` | `IServiceOrderRepository` |
| `MongoCustomerRepository` | `ICustomerRepository` |
| `MongoItemRepository` | `IItemRepository` |
| `MongoServiceRepository` | `IServiceRepository` |
| `MongoVehicleRepository` | `IVehicleRepository` |
| `MongoUserRepository` | `IUserRepository` |

### Presenters (`adapters/presenters/`)

| Classe | Formata a resposta de |
|---|---|
| `AuthPresenter` | Autenticação (login / register) |
| `CustomerPresenter` | Endpoints de clientes |
| `VehiclePresenter` | Endpoints de veículos |
| `ItemPresenter` | Endpoints de itens |
| `ServicePresenter` | Endpoints de serviços |
| `ServiceOrderPresenter` | Endpoints de ordens de serviço |

### Services (`adapters/services/`)

| Classe | Port implementada |
|---|---|
| `ConsoleNotificationService` | `INotificationService` |

## Camada 4 — Frameworks & Drivers (`src/frameworks/`)

| Componente | Arquivo | Papel |
|---|---|---|
| Factory da aplicação Express | `app.ts` | Conecta middlewares, rotas e o error handler |
| Ponto de entrada | `main.ts` | Conecta ao MongoDB e inicia o Express |
| Arquivos de rotas | `frameworks/http/routes/` | Mapeiam verbos HTTP + paths para métodos dos controllers |
| Middleware de autenticação | `frameworks/http/middlewares/authMiddleware.ts` | Verificação de JWT; injeta `req.user` |
| Middleware de papéis | `frameworks/http/middlewares/roleMiddleware.ts` | Guarda de controle de acesso baseado em papéis |
| Error handler | `frameworks/http/middlewares/errorMiddleware.ts` | Converte subclasses de `AppError` em códigos de status HTTP |
| Conexão MongoDB | `frameworks/database/` | Configuração da conexão via Mongoose |
| OpenAPI / Swagger | integrado via `swagger-jsdoc` + `swagger-ui-express` | `GET /api-docs` |
