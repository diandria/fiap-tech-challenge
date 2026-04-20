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
| `attendant` | Register customers and vehicles; open OS; run diagnosis (start/finish); generate budget                              |
| `mechanic`  | Add/remove services and items during diagnosis; start/finish individual services; finish and deliver OS              |
| `admin`     | Full access to all operations including catalog and inventory management                                             |

Budget approval and rejection endpoints are **public** (no JWT required) — confirmed with the first 4 digits of the customer's CPF or CNPJ.

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

| Transition                           | Endpoint                                        | Role                  |
|--------------------------------------|-------------------------------------------------|-----------------------|
| RECEIVED → DIAGNOSIS                 | `PATCH /service-orders/:id/start-diagnosis`     | attendant, admin      |
| DIAGNOSIS → WAITING_APPROVAL         | `PATCH /service-orders/:id/finish-diagnosis`    | attendant, admin      |
| WAITING_APPROVAL → APPROVED          | `POST /service-orders/:id/approve-budget`       | public (4-digit code) |
| WAITING_APPROVAL → REJECTED          | `POST /service-orders/:id/reject-budget`        | public (4-digit code) |
| APPROVED → EXECUTION                 | `PATCH /service-orders/:id/start-execution`     | mechanic, admin       |
| EXECUTION → FINISHED                 | `PATCH /service-orders/:id/finish`              | mechanic, admin       |
| FINISHED → DELIVERED                 | `PATCH /service-orders/:id/deliver`             | mechanic, admin       |

The 4-digit confirmation code is the **first 4 digits** of the customer's CPF or CNPJ (digits only).

Stock items are **reserved** when added to the OS during diagnosis and **consumed** (deducted from stock) when the mechanic starts execution. Rejecting a budget releases all reservations.

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

These three endpoints work without authorization:

| Endpoint | Description |
|---|---|
| `GET /service-orders/:id/status` | Check OS status and budget total |
| `POST /service-orders/:id/approve-budget` | Approve budget with 4-digit customer code |
| `POST /service-orders/:id/reject-budget` | Reject budget with 4-digit customer code |

---

### Key endpoint groups

- `POST /auth/login` — authenticate, receive JWT
- `POST /auth/register` *(admin)* — create a new user
- `GET|POST|PUT|DELETE /customers` *(attendant, admin)*
- `GET|POST|PUT|DELETE /vehicles` *(attendant, admin)*
- `GET|POST|PUT|DELETE /services` *(GET public, write admin)*
- `GET|POST|PUT|DELETE /items` *(authenticated, write admin)*
- `POST /service-orders` — create OS *(attendant, admin)*
- `GET /service-orders/:id/status` — check OS status *(public)*
- `POST /service-orders/:id/approve-budget` — approve *(public)*
- `POST /service-orders/:id/reject-budget` — reject *(public)*
