# Car Repair Shop API

REST API for managing service orders, customers, vehicles, services, and inventory for a car repair shop. Built as a FIAP Tech Challenge MVP.

---

## Architecture

Simple hexagonal (ports and adapters) monolith. The domain and application layers have zero infrastructure imports. Use cases depend on repository interfaces (ports); Mongoose implementations are injected at the route layer.

```
src/
  domain/         # Entities, port interfaces, validators, state machine
  application/    # Use cases (one file per operation)
  infrastructure/
    http/         # Express routes and middlewares
    persistence/  # Mongoose models and repository implementations
    swagger/      # OpenAPI setup
```

---

## Tech Stack

| Concern       | Choice                              |
|---------------|-------------------------------------|
| Runtime       | Node.js 20 + TypeScript             |
| HTTP          | Express                             |
| Database      | MongoDB + Mongoose                  |
| Auth          | JWT (jsonwebtoken) + bcryptjs       |
| API Docs      | swagger-ui-express + swagger-jsdoc  |
| Tests         | Jest + ts-jest + Supertest          |
| Test DB       | mongodb-memory-server               |
| Container     | Docker + docker-compose             |

---

## User Roles

| Role        | Permissions                                                                                                          |
|-------------|----------------------------------------------------------------------------------------------------------------------|
| `attendant` | Register customers and vehicles; open OS                                                                              |
| `mechanic`  | Run diagnosis (start/finish); add/remove services and items; start/finish individual services; execute, finish and deliver OS |
| `admin`     | Full access to all operations including catalog and inventory management                                             |

Budget approval and rejection use a separate **public** endpoint (`PATCH /service-orders/:id/budget`) — confirmed with the first 4 digits of the customer's CPF or CNPJ.

---

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Docker](https://docs.docker.com/get-docker/) + [docker-compose](https://docs.docker.com/compose/)

---

## Running with Docker (recommended)

```bash
docker-compose up --build
```

The API is available at `http://localhost:3000`.  
Swagger UI: `http://localhost:3000/docs`

To stop:

```bash
docker-compose down
```

---

## Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set MONGODB_URI and JWT_SECRET

# 3. Start MongoDB (or use your own instance)
docker-compose up mongo -d

# 4. Start the server
npm run dev
```

---

## Environment Variables

| Variable         | Description                                                                                    | Required |
|------------------|------------------------------------------------------------------------------------------------|----------|
| `PORT`           | HTTP port (default: `3000`)                                                                    | No       |
| `MONGODB_URI`    | MongoDB connection string                                                                      | Yes      |
| `JWT_SECRET`     | Secret used to sign JWTs (use a long random string in production)                              | Yes      |
| `CORS_ORIGIN`    | Comma-separated list of allowed origins                                                        | No       |
| `ADMIN_EMAIL`    | Email for the default admin user (default: `admin@master.com`)                                 | No       |
| `ADMIN_PASSWORD` | Password for the default admin user; if unset the seed is skipped and a warning is logged      | No       |

---

## Default Admin User

A default admin is created on first startup only when the `ADMIN_PASSWORD` environment variable is set. If `ADMIN_PASSWORD` is unset, the seed is skipped and a warning is logged — no admin user is created automatically.

| Field    | Value                                              |
|----------|----------------------------------------------------|
| email    | value of `ADMIN_EMAIL` (default: `admin@master.com`) |
| password | value of `ADMIN_PASSWORD`                          |
| role     | `admin`                                            |

Use these credentials to log in via `POST /auth/login` or directly in Swagger UI (see [Authenticating in Swagger UI](#authenticating-in-swagger-ui)).

Once logged in, use `POST /auth/register` (admin token required) to create additional users with `attendant` or `mechanic` roles.

---

## Running Tests

```bash
# All tests
npm test

# With coverage report (threshold: ≥95%)
npm run test:coverage
```

Tests use `mongodb-memory-server` — no external MongoDB required.

To run static analysis with SonarQube, `sonar-scanner` must be installed globally (not an npm dependency) — see the [SonarQube Scanner docs](https://docs.sonarsource.com/sonarqube/latest/analyzing-source-code/scanners/sonarscanner/).

---

## OS State Machine

```
RECEIVED → DIAGNOSIS → WAITING_APPROVAL → APPROVED → EXECUTION → FINISHED → DELIVERED
                                        ↘ REJECTED (terminal)
```

OS transitions are split between two body-driven endpoints:

- **Internal transitions** — `PATCH /service-orders/:id` with `{ "status": "..." }`. JWT, mechanic+admin.
- **Customer budget decision** — `PATCH /service-orders/:id/budget` with `{ "status": "APPROVED" | "REJECTED", "code": "..." }`. Public, rate-limited.

| Transition                   | Endpoint                              | Body                                              | Auth                                     |
|------------------------------|---------------------------------------|---------------------------------------------------|------------------------------------------|
| RECEIVED → DIAGNOSIS         | `PATCH /service-orders/:id`           | `{ "status": "DIAGNOSIS" }`                       | JWT — mechanic, admin                    |
| DIAGNOSIS → WAITING_APPROVAL | `PATCH /service-orders/:id`           | `{ "status": "WAITING_APPROVAL" }`                | JWT — mechanic, admin                    |
| WAITING_APPROVAL → APPROVED  | `PATCH /service-orders/:id/budget`    | `{ "status": "APPROVED", "code": "5299" }`        | public (rate-limit 5/h per IP+OS)        |
| WAITING_APPROVAL → REJECTED  | `PATCH /service-orders/:id/budget`    | `{ "status": "REJECTED", "code": "5299" }`        | public (rate-limit 5/h per IP+OS)        |
| APPROVED → EXECUTION         | `PATCH /service-orders/:id`           | `{ "status": "EXECUTION" }`                       | JWT — mechanic, admin                    |
| EXECUTION → FINISHED         | `PATCH /service-orders/:id`           | `{ "status": "FINISHED" }`                        | JWT — mechanic, admin                    |
| FINISHED → DELIVERED         | `PATCH /service-orders/:id`           | `{ "status": "DELIVERED" }`                       | JWT — mechanic, admin                    |

Each individual OS service is updated through `PATCH /service-orders/:id/services/:serviceId` with `{ "status": "IN_PROGRESS" | "COMPLETED" }` (records `startedAt`/`finishedAt`).

The 4-digit `code` is the **first 4 digits of the customer's CPF or CNPJ** (digits only).

Items are **reserved** when added to the OS during diagnosis and **consumed** (debited from stock) when the mechanic starts execution. Rejecting the budget releases all reservations.

---

## API Reference

Swagger UI is served at `/docs` when the server is running.

### Authenticating in Swagger UI

Most endpoints require a JWT. The flow inside Swagger UI is:

**1. Obtain a token**

Open `POST /auth/login`, click **Try it out**, and send:

```json
{
  "email": "admin@example.com",
  "password": "your-password"
}
```

Copy the `token` value from the response body.

**2. Authorize the session**

Click the **Authorize** button (lock icon, top-right of the page).  
In the **bearerAuth** field enter the token value — **without** the `Bearer ` prefix:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Click **Authorize**, then **Close**. All subsequent requests will include the `Authorization: Bearer <token>` header automatically.

**3. Make requests**

Expand any endpoint, click **Try it out**, fill in the parameters, and click **Execute**.

> The token expires according to the `JWT_SECRET` configuration. If you get a `401 Unauthorized`, repeat steps 1–2 to refresh it.

---

### Public endpoints (no token required)

| Endpoint | Description |
|---|---|
| `GET /service-orders/:id/status` | Read OS status and budget |
| `PATCH /service-orders/:id/budget` with `{ "status": "APPROVED", "code": "..." }` | Approve the budget using the customer's 4-digit code |
| `PATCH /service-orders/:id/budget` with `{ "status": "REJECTED", "code": "..." }` | Reject the budget using the customer's 4-digit code |

---

### Key endpoint groups

- `POST /auth/login` — authenticate and return a JWT
- `POST /auth/register` *(admin)* — create a new user
- `GET|POST|PUT|DELETE /customers` *(attendant, admin)*
- `GET|POST|PUT|DELETE /vehicles` *(attendant, admin)*
- `GET|POST|PUT|DELETE /services` *(GET authenticated, writes admin)*
- `GET|POST|PUT|DELETE /items` *(authenticated, writes admin)*
- `POST /service-orders` — create OS *(attendant, admin)*
- `GET /service-orders/:id/status` — read status *(public)*
- `PATCH /service-orders/:id` body `{ status }` — internal OS transitions *(mechanic, admin)*
- `PATCH /service-orders/:id/budget` body `{ status: APPROVED | REJECTED, code }` — customer budget decision *(public, rate-limited)*
- `PATCH /service-orders/:id/services/:serviceId` body `{ status: IN_PROGRESS | COMPLETED }` — update an individual service *(mechanic, admin)*
- `POST|DELETE /service-orders/:id/services` and `/items` — manage services/items on the OS *(mechanic, admin)*
