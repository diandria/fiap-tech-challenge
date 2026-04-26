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

**Opção B — Local (Node rodando direto, MongoDB via Docker)**

```bash
# instala dependências
npm install

# sobe só o MongoDB em background
docker-compose up mongo -d

# inicia a API em modo dev (hot-reload via ts-node)
npm run dev
```

#### 4. Verificar que está no ar

- API: http://localhost:3000
- Swagger UI: http://localhost:3000/docs

#### 5. Autenticar e usar

Faça login com o admin seed:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@master.com","password":"change-me-in-production"}'
```

A resposta traz um `token` JWT — use-o no header `Authorization: Bearer <token>` para os endpoints protegidos.

---

## Testando com Postman

A pasta `postman/` traz uma coleção pronta com **todo o fluxo ponta a ponta** (autenticação, cadastros, OS happy path, rejeição, estatísticas e cenários de erro).

```bash
# 1. Importe no Postman:
postman/car-repair-shop.postman_collection.json
postman/car-repair-shop.postman_environment.json

# 2. Selecione o environment "Car Repair Shop — Local"

# 3. Ajuste adminPassword no environment para bater com seu .env

# 4. Rode na ordem das pastas (00 → 06) — IDs e tokens são propagados automaticamente
```

Ou via CLI com Newman:

```bash
npx newman run postman/car-repair-shop.postman_collection.json \
  -e postman/car-repair-shop.postman_environment.json
```

Ver `postman/README.md` para detalhes do fluxo.

---

## Rodar Testes

```bash
# todos os testes (usa mongodb-memory-server, sem MongoDB externo)
npm test

# com cobertura (threshold ≥ 95%)
npm run test:coverage
```

Análise estática SonarQube (requer `sonar-scanner` instalado globalmente):

```bash
npm run sonar
```

---

## Variáveis de Ambiente

| Variável         | Descrição                                                                              | Obrigatória |
|------------------|----------------------------------------------------------------------------------------|-------------|
| `PORT`           | Porta HTTP (default: `3000`)                                                           | Não         |
| `MONGODB_URI`    | Connection string do MongoDB                                                           | Sim         |
| `JWT_SECRET`     | Segredo para assinar JWTs (use string longa e aleatória em produção)                   | Sim         |
| `CORS_ORIGIN`    | Origens permitidas, separadas por vírgula                                              | Não         |
| `ADMIN_EMAIL`    | Email do admin padrão (default: `admin@master.com`)                                    | Não         |
| `ADMIN_PASSWORD` | Senha do admin padrão; se vazio o seed é pulado e um warning é logado                  | Não         |

---

## Parar a Aplicação

```bash
# se subiu via Opção A
docker-compose down

# se subiu via Opção B
# Ctrl+C no terminal do npm run dev
docker-compose down  # para o mongo
```

---

## Arquitetura

Monolito hexagonal (ports & adapters) simples. Domínio e aplicação não importam infraestrutura. Use cases dependem de interfaces de repositório (ports); implementações Mongoose são injetadas na camada de rotas.

```
src/
  domain/         # Entidades, ports, validators, máquina de estados
  application/    # Use cases (um arquivo por operação)
  infrastructure/
    http/         # Rotas Express e middlewares
    persistence/  # Models Mongoose e implementações de repositório
    swagger/      # Setup OpenAPI
```

| Concern    | Stack                              |
|------------|------------------------------------|
| Runtime    | Node.js 20 + TypeScript            |
| HTTP       | Express                            |
| Database   | MongoDB + Mongoose                 |
| Auth       | JWT (jsonwebtoken) + bcryptjs      |
| API Docs   | swagger-ui-express + swagger-jsdoc |
| Tests      | Jest + ts-jest + Supertest         |
| Test DB    | mongodb-memory-server              |
| Container  | Docker + docker-compose            |

---

## Perfis de Usuário

| Role        | Permissões                                                                                                |
|-------------|-----------------------------------------------------------------------------------------------------------|
| `attendant` | Cadastrar clientes/veículos; abrir OS; iniciar/finalizar diagnóstico; gerar orçamento                     |
| `mechanic`  | Adicionar/remover serviços e itens no diagnóstico; iniciar/finalizar serviços; finalizar e entregar OS    |
| `admin`     | Acesso completo, incluindo catálogo (services, items) e gestão de usuários                                |

Aprovação e rejeição de orçamento são **públicas** (sem JWT) — confirmadas com os 4 primeiros dígitos do CPF/CNPJ do cliente.

---

## Máquina de Estados da OS

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
