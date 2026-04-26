# Architecture — Car Repair Shop API

**Project:** FIAP Tech Challenge — Phase 1  
**Version:** 1.0 (MVP)  
**Stack:** Node.js + TypeScript + Express + MongoDB

---

## 1. Context

Backend MVP for a mid-sized car repair shop. Replaces manual notes and spreadsheets with an integrated system that manages customers, vehicles, service orders, and parts inventory.

**Core problem:** service orders without traceability — no customer history, no parts control, no status visibility.

**Solution:** monolithic REST API with auditable OS state, customer-driven budget approval via verification code, and stock reservation tracked across the OS lifecycle.

---

## 2. Stack and Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Runtime | Node.js + TypeScript | Static typing prevents domain errors; native async fits IO-bound work |
| HTTP | Express | Minimal, unopinionated about structure — compatible with hexagonal architecture |
| Database | MongoDB + Mongoose | ServiceOrder is a natural document — owns services and items that have no life outside the OS; eliminates joins |
| Auth | jsonwebtoken + bcryptjs | Stateless JWT fits the MVP; bcrypt with 12 rounds for passwords |
| API Docs | swagger-jsdoc + swagger-ui-express | Documentation next to code; supports inline JSDoc on routes |
| Tests | Jest + ts-jest + Supertest + mongodb-memory-server | Unit tests with no database dependency; integration tests with no external infra |
| Container | Docker + docker-compose | Reproducible environment; project requirement |
| Rate limiting | express-rate-limit | Protects login and budget approval against brute force |

---

## 3. Architecture — Simple Hexagonal

```
src/
  domain/
    entities/          # Pure TypeScript interfaces — no framework coupling
    ports/             # Repository interfaces (ICustomerRepository, etc.)
    errors/            # AppError, NotFoundError, ValidationError
    validators.ts      # CPF, CNPJ, plate validation — pure functions
    serviceOrderStateMachine.ts  # Valid OS transitions — pure functions
  application/
    use-cases/         # One file per use case; depends only on domain ports
  infrastructure/
    http/
      routes/          # Express routers — one per resource
      middlewares/     # authMiddleware, roleMiddleware, errorMiddleware
    persistence/
      models/          # Mongoose schemas
      repositories/    # Domain port implementations
      seed.ts          # Creates default admin on first run
    swagger/           # swagger-jsdoc configuration
  app.ts               # Express setup, route registration
  main.ts              # Bootstrap, DB connection, graceful shutdown
```

**Dependency rule:** `domain/` and `application/` import nothing from `infrastructure/`. Dependency inversion is enforced by port interfaces.

**Why this matters for future phases:** adding a new database, message queue, or delivery channel only requires a new port implementation — the use cases stay the same.

---

## 4. Data Model

### Entities and relationships

```
User
  _id, email, passwordHash
  role: 'attendant' | 'mechanic' | 'admin'

Customer
  _id, name
  taxId: string        # digits only (CPF: 11, CNPJ: 14)
  taxType: 'CPF' | 'CNPJ'
  email, phone
  createdAt, updatedAt, deletedAt?   # soft delete

Vehicle
  _id
  customerId → Customer
  plate, brand, model, year

Service
  _id, name, price, estimatedMinutes

Item
  _id, name, price
  stockQuantity        # total in stock
  reservedQuantity     # reserved for in-flight OS
  # availableQuantity = stockQuantity - reservedQuantity (derived, not stored)

ServiceOrder
  _id
  customerId → Customer
  vehicleId  → Vehicle
  status: OSStatus
  budgetTotal?         # computed at the DIAGNOSIS -> WAITING_APPROVAL transition, stored as a fixed value
  services: [{ serviceId → Service, startedAt?, finishedAt? }]
  items:    [{ itemId → Item, quantity }]
  createdAt, startedAt?, finishedAt?, deliveredAt?
```

**Note:** `services[]` and `items[]` store only references (`serviceId`, `itemId`). Prices are resolved at the `DIAGNOSIS → WAITING_APPROVAL` transition and stored in `budgetTotal` — price frozen at quote time, immune to future catalog changes.

---

## 5. State Machine — Service Order

```
RECEIVED → DIAGNOSIS → WAITING_APPROVAL → APPROVED → EXECUTION → FINISHED → DELIVERED
                                        ↘ REJECTED (terminal)
```

All OS transitions are body-driven via `PATCH /service-orders/:id` with `{ status, code? }`:

| Transition | Body | Actor | Side effect |
|---|---|---|---|
| RECEIVED → DIAGNOSIS | `{ status: "DIAGNOSIS" }` | mechanic, admin | — |
| DIAGNOSIS → WAITING_APPROVAL | `{ status: "WAITING_APPROVAL" }` | mechanic, admin | Computes and persists `budgetTotal` |
| WAITING_APPROVAL → APPROVED | `{ status: "APPROVED", code: "..." }` | public (4-digit code, rate-limited) | Item reservations already made on add-item |
| WAITING_APPROVAL → REJECTED | `{ status: "REJECTED", code: "..." }` | public (4-digit code, rate-limited) | Releases `reservedQuantity` of all OS items |
| APPROVED → EXECUTION | `{ status: "EXECUTION" }` | mechanic, admin | Decrements `stockQuantity` and zeroes `reservedQuantity` of OS items |
| EXECUTION → FINISHED | `{ status: "FINISHED" }` | mechanic, admin | Records `finishedAt` |
| FINISHED → DELIVERED | `{ status: "DELIVERED" }` | mechanic, admin | Records `deliveredAt` |

Individual OS services are updated via `PATCH /service-orders/:id/services/:serviceId` with `{ status: "IN_PROGRESS" | "COMPLETED" }` (records `startedAt`/`finishedAt`).

**Approval code:** first 4 digits of the customer's CPF or CNPJ. Not actively sent in the MVP — the customer checks the OS status through the public endpoint and uses the code they already know.

**Stock reservation:**
- `add-item-to-OS` → increments `reservedQuantity`
- `remove-item-from-OS` → decrements `reservedQuantity`
- transition `EXECUTION` → decrements `stockQuantity`, zeroes `reservedQuantity`
- transition `REJECTED` → decrements `reservedQuantity` (releases reservation)

---

## 6. API — Endpoints

### Auth
| Method | Route | Access | Description |
|---|---|---|---|
| POST | /auth/login | public | Authenticate and return JWT |
| POST | /auth/register | admin | Create a new user |

### Customers
| Method | Route | Access | Description |
|---|---|---|---|
| GET | /customers | authenticated | List customers |
| POST | /customers | attendant, admin | Create customer |
| GET | /customers/:id | authenticated | Get by ID |
| GET | /customers/tax/:taxId | authenticated | Find by CPF/CNPJ |
| PUT | /customers/:id | attendant, admin | Update customer |
| DELETE | /customers/:id | attendant, admin | Soft delete |

### Vehicles
| Method | Route | Access | Description |
|---|---|---|---|
| GET | /vehicles | authenticated | List (filter: `?customerId=`) |
| POST | /vehicles | attendant, admin | Create vehicle |
| GET | /vehicles/:id | authenticated | Get by ID |
| PUT | /vehicles/:id | attendant, admin | Update vehicle |
| DELETE | /vehicles/:id | attendant, admin | Remove vehicle |

### Services (catalog)
| Method | Route | Access | Description |
|---|---|---|---|
| GET | /services | authenticated | List catalog services |
| POST | /services | admin | Create service |
| GET | /services/:id | authenticated | Get by ID |
| PUT | /services/:id | admin | Update service |
| DELETE | /services/:id | admin | Remove service |

### Items (inventory)
| Method | Route | Access | Description |
|---|---|---|---|
| GET | /items | authenticated | List items |
| POST | /items | admin | Create item |
| GET | /items/:id | authenticated | Get by ID |
| PUT | /items/:id | admin | Update item |
| DELETE | /items/:id | admin | Remove item |

### Service Orders
| Method | Route | Access | Description |
|---|---|---|---|
| GET | /service-orders | authenticated | List OS (filters: status, customerId, from, to) |
| POST | /service-orders | attendant, admin | Create OS |
| GET | /service-orders/:id | authenticated | Get OS detail |
| GET | /service-orders/stats/avg-execution | authenticated (attendant, admin) | Average execution time grouped by service |
| GET | /service-orders/:id/status | public | OS status and `budgetTotal` |
| POST | /service-orders/:id/services | mechanic, admin | Add service to OS |
| DELETE | /service-orders/:id/services/:serviceId | mechanic, admin | Remove service from OS |
| POST | /service-orders/:id/items | mechanic, admin | Add item to OS |
| DELETE | /service-orders/:id/items/:itemId | mechanic, admin | Remove item from OS |
| PATCH | /service-orders/:id | mechanic+admin (or public for `APPROVED`/`REJECTED`) | OS state transition driven by `{ status, code? }` in body |
| PATCH | /service-orders/:id/services/:serviceId | mechanic, admin | Per-service transition driven by `{ status: "IN_PROGRESS" \| "COMPLETED" }` in body |

---

## 7. Security

### Authentication and authorization
- JWT with 24h expiration; secret via env var `JWT_SECRET`
- RBAC with 3 roles: `attendant`, `mechanic`, `admin`
- `authMiddleware` validates the token on every authenticated route
- `requireRole(...roles)` enforces per-action permissions

### Rate limiting
- `POST /auth/login`: 10 req / 15 min per IP
- `PATCH /service-orders/:id` with `{ status: "APPROVED" | "REJECTED" }`: 5 req / hour per IP + OS ID combination

### Sensitive data validation
- CPF: 11 digits + validation of both check digits (mod 11)
- CNPJ: 14 digits + validation of both check digits (mod 11)
- Plate: legacy format (`ABC-1234`) and Mercosul (`ABC1D23`)
- All validation lives as pure functions in `domain/validators.ts`

### OWASP best practices
- Passwords: bcrypt with 12 rounds; never returned in responses
- CPF/CNPJ: stored as digits only; never returned in OS responses
- Queries: parameterized via Mongoose — no string interpolation
- CORS: allowlist via env var `CORS_ORIGIN`
- Security headers: `helmet` enabled

### Default admin seed
- Created on first startup via `infrastructure/persistence/seed.ts`
- Email: `ADMIN_EMAIL` (env var) — fallback: `admin@master.com`
- Password: `ADMIN_PASSWORD` (env var) — **must not rely on a fallback in production**

---

## 8. Tests

### Strategy
- **Unit** (`tests/unit/`): use-case layer; repositories mocked via port interfaces; no real database
- **Integration** (`tests/integration/`): HTTP layer through Supertest against `mongodb-memory-server`; no external infra

### Conventions
- Test descriptions follow the **GIVEN / WHEN / THEN** pattern
- Shared fixtures in `tests/unit/fixtures/` (domain objects + mock factory functions)

### Coverage
- Target: >= 80% on critical domains (use cases, state machine, validators)
- Configured in `jest.config.ts` via `coverageThreshold`

### Run
```bash
npm test                  # all tests
npm run test:coverage     # with coverage report
```

---

## 9. Infrastructure

### Environment variables

| Variable | Description | Example |
|---|---|---|
| `MONGO_URI` | MongoDB connection URI | `mongodb://mongo:27017/repair-shop` |
| `JWT_SECRET` | Secret used to sign tokens | long random string |
| `JWT_EXPIRES_IN` | Token expiration | `24h` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `PORT` | Application port | `3000` |
| `ADMIN_EMAIL` | Default admin email | `admin@master.com` |
| `ADMIN_PASSWORD` | Default admin password | — do not use a default in production — |

### Docker
```bash
# Bring up the full environment (app + MongoDB)
docker-compose up --build

# Build the image standalone
docker build -t car-repair-shop-api .
```

**Dockerfile:** multi-stage — `builder` stage compiles TypeScript; `runtime` stage copies only `dist/` and installs production dependencies.

### Swagger UI
Available at `/docs` when the application is running.

---

## 10. Gaps and Next Steps

Items identified in the Phase 1 review. All were addressed on branch `feat/phase-1-adjustments`.

| # | Item | Status |
|---|---|---|
| 1 | **Correct role for add-service/add-item** — `mechanic` per Event Storming | Done |
| 2 | **Average execution time endpoint** — `GET /service-orders/stats/avg-execution` | Done |
| 3 | **SonarQube** — `sonar-project.properties` and analysis script added | Done |
| 4 | **Vulnerability report** — `npm audit` executed and documented | Done |
| 5 | **Tests: GIVEN/WHEN/THEN** — unit test descriptions rewritten | Done |
| 6 | **DRY refactor** — `findOSOrThrow` and `verifyCustomerCode` extracted into `application/utils/` | Done |
| 7 | **Test fixtures** — `tests/unit/fixtures/` created with shared factories | Done |
| 8 | **Admin password via env var** — `ADMIN_PASSWORD` required; seed skipped if absent | Done |
| 9 | **helmet** — HTTP security headers enabled | Done |
