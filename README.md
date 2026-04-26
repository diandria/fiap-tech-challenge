# Car Repair Shop API

REST API for managing service orders, customers, vehicles, services, and inventory for a car repair shop. Built as a FIAP Tech Challenge MVP.

---

## Quick Start

Get the API running and testable in 5 minutes.

### Pré-requisitos

- [Node.js 20+](https://nodejs.org/)
- [Docker](https://docs.docker.com/get-docker/) + docker-compose
- (opcional) [Postman](https://www.postman.com/downloads/) para testar o fluxo completo

### Passo a passo

#### 1. Clonar o repositório

```bash
git clone git@github.com:diandria/fiap-tech-challenge.git
cd fiap-tech-challenge
```

#### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Abra `.env` e ajuste — em especial:

- `JWT_SECRET` — string longa e aleatória
- `ADMIN_PASSWORD` — defina uma senha; **se ficar em branco o admin padrão NÃO é criado** e você não conseguirá fazer login

Conteúdo padrão:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/car-repair-shop
JWT_SECRET=change-me-in-production-use-a-long-random-string
CORS_ORIGIN=http://localhost:3000
ADMIN_EMAIL=admin@master.com
ADMIN_PASSWORD=change-me-in-production
```

#### 3. Subir a aplicação

Escolha **uma** das duas opções abaixo.

**Opção A — Docker (mais simples, sobe app + MongoDB)**

> O `docker-compose.yml` não passa `ADMIN_EMAIL`/`ADMIN_PASSWORD` por padrão. Para criar o admin pelo seed, edite o serviço `app` em `docker-compose.yml` e adicione essas duas vars no bloco `environment` antes de subir.

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

| Transição                    | Endpoint                                        | Role                  |
|------------------------------|-------------------------------------------------|-----------------------|
| RECEIVED → DIAGNOSIS         | `PATCH /service-orders/:id/start-diagnosis`     | attendant, admin      |
| DIAGNOSIS → WAITING_APPROVAL | `PATCH /service-orders/:id/finish-diagnosis`    | attendant, admin      |
| WAITING_APPROVAL → APPROVED  | `POST /service-orders/:id/approve-budget`       | público (código 4d)   |
| WAITING_APPROVAL → REJECTED  | `POST /service-orders/:id/reject-budget`        | público (código 4d)   |
| APPROVED → EXECUTION         | `PATCH /service-orders/:id/start-execution`     | mechanic, admin       |
| EXECUTION → FINISHED         | `PATCH /service-orders/:id/finish`              | mechanic, admin       |
| FINISHED → DELIVERED         | `PATCH /service-orders/:id/deliver`             | mechanic, admin       |

Itens são **reservados** ao serem adicionados na OS durante o diagnóstico e **consumidos** (debitados do estoque) quando o mecânico inicia a execução. Rejeitar o orçamento libera todas as reservas.

---

## Endpoints Principais

Documentação completa em Swagger UI (`/docs`).

- `POST /auth/login` — autentica, retorna JWT
- `POST /auth/register` *(admin)* — cria novo usuário
- `GET|POST|PUT|DELETE /customers` *(attendant, admin)*
- `GET|POST|PUT|DELETE /vehicles` *(attendant, admin)*
- `GET|POST|PUT|DELETE /services` *(GET público, escrita admin)*
- `GET|POST|PUT|DELETE /items` *(autenticado, escrita admin)*
- `POST /service-orders` — criar OS *(attendant, admin)*
- `GET /service-orders/:id/status` — consultar status *(público)*
- `POST /service-orders/:id/approve-budget` — aprovar *(público)*
- `POST /service-orders/:id/reject-budget` — rejeitar *(público)*

### Autenticando no Swagger UI

1. Em `POST /auth/login`, clique **Try it out**, envie `{"email":"...","password":"..."}` e copie o `token` da resposta.
2. Clique no botão **Authorize** (cadeado, topo direito) e cole o token no campo `bearerAuth` (sem o prefixo `Bearer `). Confirme.
3. Os requests subsequentes já vão com o header `Authorization: Bearer <token>`. Se aparecer `401`, repita os passos 1–2.
