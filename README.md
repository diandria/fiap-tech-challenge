# Car Repair Shop API

API REST para gerenciar ordens de serviço, clientes, veículos, serviços e estoque de uma oficina mecânica. Desenvolvida como MVP do FIAP Tech Challenge.

---

## Sumário

1. [Arquitetura](#arquitetura)
2. [Stack](#stack)
3. [Papéis de Usuário](#papéis-de-usuário)
4. [Pré-requisitos](#pré-requisitos)
5. [Quickstart (um comando)](#quickstart-um-comando)
6. [Setup manual passo a passo](#setup-manual-passo-a-passo)
7. [Como verificar que está no ar](#como-verificar-que-está-no-ar)
8. [Autenticação](#autenticação)
9. [Trocar senhas (e onde mais atualizar)](#trocar-senhas-e-onde-mais-atualizar)
10. [Seed de desenvolvimento](#seed-de-desenvolvimento)
11. [Testando com Postman](#testando-com-postman)
12. [Rodar testes](#rodar-testes)
13. [SonarQube (opcional)](#sonarqube-opcional)
14. [Variáveis de ambiente](#variáveis-de-ambiente)
15. [Parar a aplicação](#parar-a-aplicação)
16. [API Reference (Swagger)](#api-reference-swagger)

---

## Arquitetura

Monolito hexagonal (ports & adapters). Veja [docs/architecture.md](docs/architecture.md) para o design completo — camadas, modelo de dados, máquina de estados e decisões de infra. Termos do domínio em [docs/ddd/ubiquitous-language.md](docs/ddd/ubiquitous-language.md).

---

## Stack

| Tema       | Escolha                             |
|------------|-------------------------------------|
| Runtime    | Node.js 20 + TypeScript             |
| HTTP       | Express                             |
| Banco      | MongoDB + Mongoose                  |
| Auth       | JWT (jsonwebtoken) + bcryptjs       |
| Docs API   | swagger-ui-express + swagger-jsdoc  |
| Testes     | Jest + ts-jest + Supertest          |
| Test DB    | mongodb-memory-server               |
| Container  | Docker + docker-compose             |

---

## Papéis de Usuário

| Role        | Permissões                                                                                                                              |
|-------------|------------------------------------------------------------------------------------------------------------------------------------------|
| `attendant` | Cadastra clientes e veículos; abre OS informando opcionalmente os serviços e peças solicitados pelo cliente                              |
| `mechanic`  | Executa diagnóstico (start/finish); refina lista de serviços e itens (adiciona ou remove); inicia e finaliza serviços individuais; executa, finaliza e entrega a OS |
| `admin`     | Acesso total, incluindo gestão de catálogo e estoque                                                                                     |

Aprovação e rejeição de orçamento usam um endpoint **público** separado (`PATCH /service-orders/:id/budget`) — confirmado com os primeiros 4 dígitos do CPF/CNPJ do cliente.

---

## Pré-requisitos

- [Node.js 20+](https://nodejs.org/)
- [Docker](https://docs.docker.com/get-docker/) + [docker-compose](https://docs.docker.com/compose/)

---

## Quickstart (um comando)

Do zero, com tudo limpo:

```bash
./scripts/bootstrap.sh
```

O script faz, na ordem:

1. Copia `.env.example` para `.env` (se ainda não existir).
2. Roda `npm install`.
3. Sobe `app` e `mongo` via `docker-compose up -d`.
4. Aguarda 5 segundos para o MongoDB inicializar.
5. Roda `npm run seed:dev` (popula catálogo, clientes, veículos e usuários de dev).
6. Imprime as URLs da API e do Swagger.

Se preferir entender ou customizar cada passo, veja a próxima seção.

---

## Setup manual passo a passo

Faz exatamente o que o `bootstrap.sh` faz, mas com você no controle.

### 1. Criar o `.env`

```bash
cp .env.example .env
```

Edite os valores se quiser (especialmente `ADMIN_PASSWORD` e `JWT_SECRET` em produção).

### 2. Instalar dependências do Node

```bash
npm install
```

### 3. Subir os containers

```bash
docker-compose up -d
```

Sobe `app` (Node + Express na porta 3000) e `mongo` (MongoDB 7 na porta 27017). Aguarde alguns segundos para o MongoDB ficar pronto.

> Se quiser rodar a API direto via ts-node em modo dev (hot-reload), use `npm run dev` e suba só o Mongo: `docker-compose up -d mongo`.

### 4. Popular o banco com dados de exemplo

```bash
npm run seed:dev
```

Cria catálogo, clientes, veículos e 3 usuários de desenvolvimento. Detalhes em [Seed de desenvolvimento](#seed-de-desenvolvimento).

---

## Como verificar que está no ar

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/docs>

Teste rápido de login com o admin do `.env` (default `admin@master.com` / `change-me-in-production`):

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@master.com","password":"change-me-in-production"}'
```

Resposta traz um `token` JWT — use no header `Authorization: Bearer <token>`.

---

## Autenticação

Todos os endpoints protegidos pedem JWT no header:

```
Authorization: Bearer <token>
```

O token é obtido via `POST /auth/login` (público, rate-limited 10 req / 15 min por IP) e expira em 24h. Quando expirar, faça login de novo.

Endpoints públicos que **não** pedem token:

| Endpoint | Descrição |
|---|---|
| `POST /auth/login` | Login |
| `GET /service-orders/:id/status` | Lê o status e o orçamento da OS |
| `PATCH /service-orders/:id/budget` | Aprova ou rejeita o orçamento (rate-limited 5 req/h por IP+OS) |

---

## Trocar senhas (e onde mais atualizar)

O sistema tem **dois conjuntos** de credenciais que podem ser alterados, e cada um tem seus pontos de propagação. Mantenha sincronizado para a Quickstart e o Postman continuarem funcionando.

### Senha do admin padrão (vem do `.env`)

Criada na primeira execução pelo seed runtime (`src/infrastructure/persistence/seed.ts`).

| Onde | O que ajustar |
|---|---|
| `.env` | `ADMIN_EMAIL` e `ADMIN_PASSWORD` |
| `postman/car-repair-shop.postman_environment.json` | Valores de `adminEmail` e `adminPassword` |
| Banco existente (se já rodou antes) | Se a senha já foi gravada com o valor antigo, apague o usuário no Mongo: `db.users.deleteOne({ email: "<email-antigo>" })` e suba a app de novo |

> O seed runtime só cria o admin se ele **não existir**. Se você mudou `ADMIN_PASSWORD` no `.env` e o admin já está no banco com a senha antiga, mude no banco direto ou apague e deixe o seed recriar.

### Senhas dos usuários de seed dev (`admin@dev.local`, `attendant@dev.local`, `mechanic@dev.local`)

Criados pelo `npm run seed:dev` com a senha hard-coded `dev123`.

| Onde | O que ajustar |
|---|---|
| `scripts/seed-dev.ts` | Constante `USERS` (ex.: trocar `password: 'dev123'`) |
| `postman/car-repair-shop.postman_environment.json` | Se você usar esses usuários no Postman, ajuste `attendantPassword`/`mechanicPassword` |
| Banco existente | Mesmo cuidado do admin: o seed pula usuários já existentes (`ConflictError` capturado). Apague no Mongo se precisar regenerar |

> A coleção Postman registra **seus próprios** atendente e mecânico (`attendant@test.com` / `mechanic@test.com` com senha `Pass1234`) na pasta `00 - Setup`. Esses são independentes do seed dev. Os do seed servem pra teste manual via Swagger ou curl.

### Senha do SonarQube

Trocada no primeiro login da UI (forçado). Não há referência em arquivo do projeto — é só local.

---

## Seed de desenvolvimento

Para facilitar testes manuais, o `npm run seed:dev` popula o banco com um conjunto fixo:

- **5 serviços**: Oil Change, Wheel Alignment, Brake Pad Replacement, Battery Check, Engine Tune-up.
- **6 itens** (com estoque): 5W30 Synthetic Oil, Front Brake Pad Kit, Air Filter, Battery 60Ah, Spark Plug, Engine Coolant 1L.
- **4 clientes** (3 CPFs + 1 CNPJ).
- **7 veículos** distribuídos entre os clientes — alguns têm mais de um veículo (Maria Santos com 2, Auto Frota LTDA com 3) para exercitar listagem por `customerId`.
- **3 usuários** (senha: `dev123`):
  - `admin@dev.local` (admin)
  - `attendant@dev.local` (attendant)
  - `mechanic@dev.local` (mechanic)
  - **Não use em produção** — senha fraca, apenas para dev.

O script é **idempotente**: pode rodar várias vezes; registros já existentes (mesmo `taxId`, mesma placa, mesmo nome de serviço/item, mesmo email de usuário) são pulados.

Pré-requisitos: MongoDB rodando e variável `MONGODB_URI` configurada (mesma usada pela API).

```bash
npm run seed:dev
```

---

## Testando com Postman

A pasta `postman/` traz uma coleção pronta com **todo o fluxo ponta a ponta** (autenticação, cadastros, OS happy path, rejeição, estatísticas e cenários de erro).

```bash
# 1. Importe no Postman:
postman/car-repair-shop.postman_collection.json
postman/car-repair-shop.postman_environment.json

# 2. Selecione o environment "Car Repair Shop - Local"

# 3. Confirme adminPassword no environment (deve bater com ADMIN_PASSWORD do .env)

# 4. Rode na ordem das pastas (00 → 06) — IDs e tokens são propagados automaticamente
```

Ou via CLI com Newman:

```bash
npx newman run postman/car-repair-shop.postman_collection.json \
  -e postman/car-repair-shop.postman_environment.json
```

Veja `postman/README.md` para detalhes do fluxo.

---

## Rodar testes

```bash
# todos os testes (usa mongodb-memory-server, sem MongoDB externo)
npm test

# com cobertura (threshold ≥ 80%)
npm run test:coverage
```

Para análise estática com SonarQube, veja a próxima seção.

---

## SonarQube (opcional)

Análise estática rodando em SonarQube local via Docker. O serviço é pesado (~2 GB RAM, sobe em 1-2 min) e fica fora do `docker-compose up` padrão — só sobe sob o profile `sonar`.

### Pré-requisitos

- Docker (já listado em [Pré-requisitos](#pré-requisitos)).
- `vm.max_map_count >= 262144` no host (Linux/WSL):
  ```bash
  sudo sysctl -w vm.max_map_count=262144
  ```
  Para persistir, adicione `vm.max_map_count=262144` em `/etc/sysctl.conf`.
- Pelo menos 2 GB de RAM livres.

### Subir

```bash
docker-compose --profile sonar up -d sonarqube sonar-db
```

Aguarde 1-2 min até `http://localhost:9000` responder.

### Configurar o token

1. Abra <http://localhost:9000>, login `admin` / `admin`, troque a senha (qualquer valor — só local).
2. **My Account → Security → Generate Token** — copie o valor.
3. Descomente e preencha as duas linhas no `.env`:
   ```
   SONAR_HOST_URL=http://localhost:9000
   SONAR_TOKEN=<token-gerado>
   ```

### Rodar a análise

```bash
npm run test:coverage   # gera coverage/lcov.info
npm run sonar           # roda sonar-scanner via Docker e envia para o servidor local
```

`npm run sonar` usa a imagem oficial `sonarsource/sonar-scanner-cli` (download na primeira execução, ~150 MB). Não exige Java instalado no host. Os valores de `SONAR_HOST_URL` e `SONAR_TOKEN` vêm do `.env` via `--env-file`.

Resultado em `http://localhost:9000/dashboard?id=car-repair-shop-api`.

---

## Variáveis de ambiente

| Variável         | Descrição                                                                              | Obrigatória |
|------------------|----------------------------------------------------------------------------------------|-------------|
| `PORT`           | Porta HTTP (default: `3000`)                                                           | Não         |
| `MONGODB_URI`    | Connection string do MongoDB                                                           | Sim         |
| `JWT_SECRET`     | Segredo para assinar JWTs (use string longa e aleatória em produção)                   | Sim         |
| `CORS_ORIGIN`    | Origens permitidas, separadas por vírgula                                              | Não         |
| `ADMIN_EMAIL`    | Email do admin padrão (default: `admin@master.com`)                                    | Não         |
| `ADMIN_PASSWORD` | Senha do admin padrão; se vazio, o seed é pulado e um warning é logado                 | Não         |
| `SONAR_HOST_URL` | URL do servidor SonarQube (ex.: `http://localhost:9000`)                               | Não         |
| `SONAR_TOKEN`    | Token gerado na UI do SonarQube; obrigatório só para rodar `npm run sonar`             | Não         |

---

## Parar a aplicação

```bash
# Para app + mongo
docker-compose down

# Inclui também os containers do SonarQube (se estiverem subidos)
docker-compose --profile sonar down

# Remover também os volumes (dados perdidos!)
docker-compose --profile sonar down -v
```

---

## API Reference (Swagger)

Swagger UI servido em `/docs` enquanto o servidor está rodando.

### Autenticando no Swagger UI

A maioria dos endpoints exige JWT. O fluxo dentro do Swagger UI:

**1. Obter um token**

Abra `POST /auth/login`, clique **Try it out** e envie:

```json
{
  "email": "admin@master.com",
  "password": "change-me-in-production"
}
```

Copie o valor de `token` da response.

**2. Autorizar a sessão**

Clique no botão **Authorize** (ícone de cadeado, canto superior direito).
No campo **bearerAuth** cole o token — **sem** o prefixo `Bearer `:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Clique **Authorize**, depois **Close**. Todas as requisições seguintes vão incluir o header `Authorization: Bearer <token>` automaticamente.

**3. Fazer requisições**

Expanda qualquer endpoint, clique **Try it out**, preencha os parâmetros e clique **Execute**.

> O token expira segundo a configuração de `JWT_SECRET`. Se receber um `401 Unauthorized`, repita os passos 1-2 para renovar.

### Endpoints públicos (sem token)

| Endpoint | Descrição |
|---|---|
| `POST /auth/login` | Login |
| `GET /service-orders/:id/status` | Lê o status e o orçamento da OS |
| `PATCH /service-orders/:id/budget` com `{ "status": "APPROVED", "code": "..." }` | Aprova o orçamento usando os 4 dígitos do CPF/CNPJ do cliente |
| `PATCH /service-orders/:id/budget` com `{ "status": "REJECTED", "code": "..." }` | Rejeita o orçamento usando os 4 dígitos do CPF/CNPJ do cliente |

### Grupos principais de endpoints

- `POST /auth/login` — autentica e retorna um JWT
- `POST /auth/register` *(admin)* — cria um novo usuário
- `GET|POST|PUT|DELETE /customers` *(attendant, admin)*
- `GET|POST|PUT|DELETE /vehicles` *(attendant, admin)*
- `GET|POST|PUT|DELETE /services` *(GET autenticado, escritas admin)*
- `GET /services/avg-time` *(admin, mechanic, attendant)* — lista serviços do catálogo com tempo médio cadastrado (`id`, `name`, `estimatedMinutes`)
- `GET|POST|PUT|DELETE /items` *(autenticado, escritas admin)*
- `POST /service-orders` — cria OS com serviços e peças opcionais *(attendant, admin)*
- `GET /service-orders/:id/status` — lê status *(público)*
- `PATCH /service-orders/:id` body `{ status }` — transições internas da OS *(mechanic, admin)*
- `PATCH /service-orders/:id/budget` body `{ status: APPROVED | REJECTED, code }` — decisão do cliente *(público, rate-limited)*
- `PATCH /service-orders/:id/services/:serviceId` body `{ status: IN_PROGRESS | COMPLETED }` — atualiza um serviço individual *(mechanic, admin)*
- `POST|DELETE /service-orders/:id/services` e `/items` — gerencia serviços/itens da OS *(mechanic, admin)*
- `DELETE /service-orders/:id/services/:serviceId` — remove serviço da OS em DIAGNOSIS *(mechanic, admin)*
- `DELETE /service-orders/:id/items/:itemId` — remove peça da OS em DIAGNOSIS, libera estoque *(mechanic, admin)*
