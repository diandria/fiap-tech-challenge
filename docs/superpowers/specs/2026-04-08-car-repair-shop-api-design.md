# Car Repair Shop API — Design Spec

**Date:** 2026-04-08  
**Status:** Approved

---

## Overview

Monolithic REST API MVP for a car repair shop (oficina mecânica). Manages service orders (OS), customers, vehicles, services, and inventory. Built for the FIAP Tech Challenge.

---

## Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js + TypeScript |
| HTTP | Express |
| Database | MongoDB + Mongoose |
| Auth | `jsonwebtoken` + `bcryptjs` |
| API Docs | `swagger-ui-express` + `swagger-jsdoc` |
| Tests | Jest + `ts-jest` + Supertest + `mongodb-memory-server` |
| Config | `dotenv` |
| Container | Docker + docker-compose |
| Rate limiting | `express-rate-limit` (auth + public budget endpoints) |

No other runtime dependencies.

---

## Architecture — Simple Hexagonal

```
src/
  domain/
    entities/        # Plain TS interfaces (no framework coupling)
    ports/           # Repository interfaces (ICustomerRepository, etc.)
  application/
    use-cases/       # One file per use case; depends only on domain ports
  infrastructure/
    http/
      routes/        # Express routers (one per resource)
      middlewares/   # auth guard, role guard, error handler
    persistence/     # Mongoose schemas + repository implementations
  app.ts             # Express setup, route registration
  main.ts            # Bootstrap, graceful shutdown
```

**Dependency rule:** `domain/` and `application/` import nothing from `infrastructure/`. Dependency inversion is enforced via port interfaces.

**SOLID application:**
- **S** — one use case per file; each class/function has one reason to change
- **O** — new OS transitions are new use cases, not edits to existing ones
- **L** — repository implementations are interchangeable behind port interfaces
- **I** — one interface per repository (no fat ports combining unrelated operations)
- **D** — use cases depend on port interfaces injected at runtime, never on Mongoose directly

**TDD rule:** for every use case, write the test first. No implementation code without a failing test. Ports make this trivial — use cases are tested with in-memory fakes, no DB required.

**Why MongoDB:** The `ServiceOrder` is a natural document — it owns its service and item references, always read together, with no life outside the OS context. This eliminates junction collections and join complexity.

---

## Entities (6 collections)

```typescript
User {
  _id, email, passwordHash,
  role: 'attendant' | 'mechanic' | 'admin'
}

Customer {
  _id, name,
  taxId: string,        // digits only (CPF: 11, CNPJ: 14) — formatted input stripped on write
  taxType: 'CPF' | 'CNPJ',
  email, phone,
  createdAt, updatedAt,
  deletedAt?            // soft delete
}

Vehicle {
  _id, customerId, plate, brand, model, year
}

Service {
  _id, name, price, estimatedMinutes
}

Item {
  _id, name, price, stockQuantity, reservedQuantity
}
// availableQuantity = stockQuantity - reservedQuantity (derived, not stored)

ServiceOrder {
  _id,
  customerId,
  vehicleId,
  status: OSStatus,
  budgetTotal,          // calculated at finish-diagnosis, stored once
  services: [{ serviceId, startedAt?, finishedAt? }],
  items:    [{ itemId, quantity }],
  createdAt, startedAt?, finishedAt?, deliveredAt?
}
```

`services[]` and `items[]` store **references only** (`serviceId`, `itemId`). `budgetTotal` is resolved by looking up current prices at `finish-diagnosis` time and stored as a fixed value.

---

## OS State Machine

```
RECEIVED → DIAGNOSIS → WAITING_APPROVAL → EXECUTION → FINISHED → DELIVERED
                                        ↘ REJECTED (terminal)
```

| Transition | Trigger | Actor |
|---|---|---|
| RECEIVED → DIAGNOSIS | `start-diagnosis` | attendant, admin |
| DIAGNOSIS → WAITING_APPROVAL | `finish-diagnosis` (calculates budget) | attendant, admin |
| WAITING_APPROVAL → EXECUTION | `approve-budget` | public (4-digit code) |
| WAITING_APPROVAL → REJECTED | `reject-budget` | public (4-digit code) |
| EXECUTION → FINISHED | `finish-os` | mechanic, admin |
| FINISHED → DELIVERED | `deliver-os` | mechanic, admin |

On `approve-budget`: decrement item stock (reservation → consumption).  
On `reject-budget`: release all item stock reservations.

---

## Role Permissions (RBAC)

| Action | attendant | mechanic | admin |
|---|:---:|:---:|:---:|
| CRUD customers | ✓ | | ✓ |
| CRUD vehicles | ✓ | | ✓ |
| CRUD services catalog | | | ✓ |
| CRUD items (inventory) | | | ✓ |
| Create OS | ✓ | | ✓ |
| Add services / items to OS | ✓ | | ✓ |
| Start diagnosis | ✓ | | ✓ |
| Finish diagnosis (generate budget) | ✓ | | ✓ |
| Start / finish individual service | | ✓ | ✓ |
| Finish OS | | ✓ | ✓ |
| Deliver OS | | ✓ | ✓ |
| List / view all OS | ✓ | ✓ | ✓ |
| Manage users | | | ✓ |
| approve-budget / reject-budget | public | public | public |

---

## API Endpoints

### Auth
```
POST /auth/login       { email, password } → { token }
POST /auth/register    { email, password, role }  [admin only]
```

### Customers
```
GET    /customers
POST   /customers      { name, taxId, taxType, email, phone }
GET    /customers/:id
GET    /customers/tax/:taxId
PUT    /customers/:id
DELETE /customers/:id   (soft delete — sets deletedAt)
```

### Vehicles
```
GET    /vehicles?customerId=
POST   /vehicles       { customerId, plate, brand, model, year }
GET    /vehicles/:id
PUT    /vehicles/:id
DELETE /vehicles/:id
```

### Services (catalog)
```
GET    /services
POST   /services       { name, price, estimatedMinutes }
GET    /services/:id
PUT    /services/:id
DELETE /services/:id
```

### Items (inventory)
```
GET    /items
POST   /items          { name, price, stockQuantity }
GET    /items/:id
PUT    /items/:id
DELETE /items/:id
```

### Service Orders
```
POST   /service-orders                          { customerId, vehicleId }
GET    /service-orders                          ?status=&customerId=&from=&to=
GET    /service-orders/:id
GET    /service-orders/:id/status               [public]

POST   /service-orders/:id/services             { serviceId }
DELETE /service-orders/:id/services/:serviceId
POST   /service-orders/:id/items                { itemId, quantity }
DELETE /service-orders/:id/items/:itemId

PATCH  /service-orders/:id/start-diagnosis
PATCH  /service-orders/:id/finish-diagnosis

POST   /service-orders/:id/approve-budget       { code } [public, rate-limited]
POST   /service-orders/:id/reject-budget        { code } [public, rate-limited]

PATCH  /service-orders/:id/services/:serviceId/start
PATCH  /service-orders/:id/services/:serviceId/finish
PATCH  /service-orders/:id/finish
PATCH  /service-orders/:id/deliver
```

---

## Validation

All implemented as **pure functions** in `domain/` — no library.

| Field | Rule |
|---|---|
| CPF | 11 digits + both check digits (mod 11) |
| CNPJ | 14 digits + both check digits (mod 11) |
| Plate (old) | `/^[A-Z]{3}-?\d{4}$/i` |
| Plate (Mercosul) | `/^[A-Z]{3}\d[A-Z]\d{2}$/i` |
| Budget code | First 4 digits of customer's CPF/CNPJ |

---

## Security (OWASP Top 10)

- **Passwords:** bcrypt, 12 rounds
- **JWT:** 24h expiry, secret from env, `Authorization: Bearer` header
- **Queries:** Mongoose parameterized — no raw string interpolation
- **Input:** validated on all routes before reaching use cases
- **CORS:** explicit origin allowlist via env
- **Rate limiting:**
  - `POST /auth/login`: 10 req/15min per IP
  - `POST /service-orders/:id/approve-budget` and `reject-budget`: 5 req/hour per OS ID
- **Sensitive data:** no passwords or CPF/CNPJ in API responses

---

## Testing Strategy

- **Unit tests:** use-case layer; repositories mocked via port interfaces; covers business logic, state machine transitions, validators
- **Integration tests:** HTTP layer via Supertest against `mongodb-memory-server` (no real DB needed in CI)
- **Coverage gate:** ≥ 80% (enforced in Jest config)
- **TDD:** tests written before implementation per use case

---

## Infrastructure

**Dockerfile** (multi-stage):
1. `builder` stage: compile TypeScript
2. `runtime` stage: copy `dist/`, install prod deps only

**docker-compose.yml:**
- `app`: built from Dockerfile, depends on `mongo`
- `mongo`: `mongo:7` official image with volume

**Migrations / Indexes:** defined in Mongoose schema files (unique indexes on `email`, `taxId`, `plate`).

---

## Implementation Phases

### Phase 1 — Foundation
1. Scaffold: TypeScript, Express, Jest/ts-jest, ESLint, tsconfig, dotenv
2. MongoDB connection + Mongoose base setup + `mongodb-memory-server` for tests
3. Shared error classes + Express error handler middleware
4. Auth: login, register, JWT middleware, role guard

### Phase 2 — Core Domain
5. Customers: CRUD + CPF/CNPJ validator (TDD)
6. Vehicles: CRUD + plate validator (TDD)
7. Services catalog: CRUD (TDD)
8. Items (inventory): CRUD + stock reservation logic (TDD)

### Phase 3 — Service Orders
9. ServiceOrder creation + state machine (TDD — unit-test every transition)
10. Add/remove services and items + budget calculation at finish-diagnosis
11. Public approve/reject endpoints + rate limiting + 4-digit code validation
12. Stock side effects: reserve on add, decrement on approve-budget, release on reject-budget
13. Execution transitions: start/finish per service, timestamp tracking
14. Customer public status endpoint + admin list with filters

### Phase 4 — Quality & Delivery
15. Integration tests (Supertest + `mongodb-memory-server`), coverage gate ≥ 80%
16. Swagger docs (`/docs`) — all endpoints annotated
17. Dockerfile + docker-compose
18. README: setup, env vars, test commands, architecture overview
