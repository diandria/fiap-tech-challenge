# Car Repair Shop API

REST API for managing service orders, customers, vehicles, services, and inventory for a car repair shop. Built as a FIAP Tech Challenge MVP.

---

## Architecture

Hexagonal monolith (ports & adapters). See [docs/architecture.md](docs/architecture.md) for the full design — layers, data model, state machine, and infra decisions.

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

## Quickstart

```bash
./scripts/bootstrap.sh
```

Sobe app + mongo, instala dependências, copia `.env` e roda o seed. Para incluir SonarQube local: `./scripts/bootstrap.sh --with-sonar`.

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

## Popular Dados de Desenvolvimento (Seed)

Para facilitar o teste manual dos fluxos, há um script que popula o banco com um conjunto de dados de exemplo (catálogo, clientes e veículos):

```bash
npm run seed:dev
```

Cria:

- **5 serviços**: Oil Change, Wheel Alignment, Brake Pad Replacement, Battery Check, Engine Tune-up.
- **6 itens** (com estoque): 5W30 Synthetic Oil, Front Brake Pad Kit, Air Filter, Battery 60Ah, Spark Plug, Engine Coolant 1L.
- **4 clientes** (3 CPFs + 1 CNPJ).
- **7 veículos** distribuídos entre os clientes — alguns clientes têm mais de um veículo (Maria Santos com 2, Auto Frota LTDA com 3) para exercitar listagem por `customerId`.
- **3 usuários** (senha: `dev123`): `admin@dev.local` (admin), `attendant@dev.local` (attendant), `mechanic@dev.local` (mechanic). **Não use em produção** — senha fraca, apenas para dev.

O script é **idempotente**: roda quantas vezes quiser que os registros já existentes (mesma `taxId`, mesma placa, mesmo nome de serviço/item) são pulados.

Pré-requisitos: MongoDB rodando e variável `MONGODB_URI` configurada (mesma usada pela API).

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

## SonarQube (opcional)

Análise estática rodando em SonarQube local via Docker. O serviço é pesado (~2 GB RAM, sobe em 1-2 min) e fica fora do `docker-compose up` padrão — só sobe sob o profile `sonar`.

### Pré-requisitos

- Docker (já listado em [Prerequisites](#prerequisites)).
- `vm.max_map_count >= 262144` no host (Linux/WSL):
  ```bash
  sudo sysctl -w vm.max_map_count=262144
  ```
  Para persistir, adicione `vm.max_map_count=262144` em `/etc/sysctl.conf`.
- Pelo menos 2 GB de RAM livres.

### Subir

```bash
docker-compose --profile sonar up -d sonarqube sonar-db
# ou: ./scripts/bootstrap.sh --with-sonar
```

Aguarde 1-2 min até `http://localhost:9000` responder.

### Configurar o token

1. Abra `http://localhost:9000`, login `admin` / `admin`, troque a senha.
2. **My Account → Security → Generate Token** — copie o valor.
3. Adicione ao `.env`:
   ```
   SONAR_HOST_URL=http://localhost:9000
   SONAR_TOKEN=<token-gerado>
   ```

### Rodar a análise

```bash
npm run test:coverage   # gera coverage/lcov.info
npm run sonar           # envia para o servidor local
```

Resultado em `http://localhost:9000/dashboard?id=car-repair-shop-api`.

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
| `SONAR_HOST_URL` | URL do servidor SonarQube (ex.: `http://localhost:9000`)                                | Não         |
| `SONAR_TOKEN`    | Token gerado na UI do SonarQube; obrigatório só para rodar `npm run sonar`              | Não         |

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
