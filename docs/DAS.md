# Documento de Arquitetura de Software (DAS) — Car Repair Shop API

**Projeto:** FIAP Tech Challenge — Fase 1
**Versão:** 1.0 (MVP)
**Stack:** Node.js + TypeScript + Express + MongoDB

---

## 1. Introdução e Objetivos

MVP de backend para uma oficina mecânica de médio porte. Substitui anotações manuais e planilhas por um sistema integrado que gerencia clientes, veículos, ordens de serviço e estoque de peças.

**Problema central:** ordens de serviço sem rastreabilidade — sem histórico do cliente, sem controle de peças, sem visibilidade de status.

**Solução:** API REST monolítica com estado de OS auditável, aprovação de orçamento pelo cliente via código de verificação e reserva de estoque acompanhada ao longo do ciclo de vida da OS.

### Objetivos principais

- Fornecer ciclo completo da Ordem de Serviço (OS), do recebimento à entrega, com estado controlado.
- Permitir aprovação/rejeição de orçamento pelo cliente sem necessidade de login (autenticação por código de 4 dígitos).
- Controlar estoque de peças com reserva por OS em andamento.
- Disponibilizar API documentada (Swagger UI) e cobertura de testes mensurável.

### 1.1 Requisitos Funcionais

Derivados dos use cases em `src/application/use-cases/` e dos endpoints expostos.

#### Autenticação e usuários

| ID | Requisito | Ator |
|---|---|---|
| RF-01 | Autenticar usuário por e-mail e senha, retornando um JWT | Todos os papéis internos |
| RF-02 | Cadastrar novo usuário interno informando papel (`attendant`, `mechanic`, `admin`) | `admin` |

#### Clientes e veículos

| ID | Requisito | Ator |
|---|---|---|
| RF-03 | Cadastrar cliente (PF/PJ) com CPF ou CNPJ, e-mail, telefone | `attendant`, `admin` |
| RF-04 | Consultar cliente por ID e por CPF/CNPJ | `attendant`, `admin` |
| RF-05 | Listar clientes ativos | `attendant`, `admin` |
| RF-06 | Atualizar dados cadastrais do cliente | `attendant`, `admin` |
| RF-07 | Remover cliente (soft delete, preservando histórico de OSs) | `attendant`, `admin` |
| RF-08 | Cadastrar veículo vinculado a um cliente | `attendant`, `admin` |
| RF-09 | Consultar veículo por ID e listar veículos de um cliente | `attendant`, `admin` |
| RF-10 | Atualizar e remover veículo | `attendant`, `admin` |

#### Catálogo (serviços e peças)

| ID | Requisito | Ator |
|---|---|---|
| RF-11 | CRUD de serviços do catálogo (nome, preço, tempo estimado) | `admin` |
| RF-12 | CRUD de itens do catálogo com controle de estoque (`stockQuantity`, `reservedQuantity`) | `admin` |
| RF-30 | Listar serviços do catálogo com tempo médio cadastrado (`id`, `name`, `estimatedMinutes`) | `admin`, `mechanic`, `attendant` |

#### Ordem de Serviço (OS) — fluxo principal

| ID | Requisito | Ator |
|---|---|---|
| RF-13 | Criar OS associada a um cliente e um veículo, com lista opcional de serviços e peças informada pelo cliente na abertura; estoque das peças é reservado imediatamente | `attendant` |
| RF-14 | Iniciar diagnóstico (`RECEIVED → DIAGNOSIS`) | `mechanic` |
| RF-15 | No diagnóstico, o mecânico refina a lista pré-montada pelo cliente: pode adicionar serviços ausentes e remover serviços que não se aplicarem após avaliação técnica | `mechanic` |
| RF-16 | No diagnóstico, o mecânico refina a lista pré-montada pelo cliente: pode adicionar peças reservando estoque (`reservedQuantity++`) e remover peças liberando o estoque reservado na abertura (`reservedQuantity--`) | `mechanic` |
| RF-17 | Encerrar diagnóstico calculando `budgetTotal = Σ services + Σ (item.price × qty)` (`DIAGNOSIS → WAITING_APPROVAL`) | `mechanic` |
| RF-18 | Disparar notificação ao cliente quando o orçamento entra em `WAITING_APPROVAL` (port `INotificationService`) | Sistema |
| RF-19 | Permitir consulta pública do status de uma OS por ID, sem autenticação | Cliente final |
| RF-20 | Permitir aprovação ou rejeição pública do orçamento mediante código de 4 dígitos derivado do CPF/CNPJ (`WAITING_APPROVAL → APPROVED \| REJECTED`) | Cliente final |
| RF-21 | Liberar o estoque reservado quando o orçamento é rejeitado | Sistema |
| RF-22 | Iniciar execução consumindo o estoque reservado (`APPROVED → EXECUTION`, decrementa `stockQuantity` e `reservedQuantity`) | `mechanic` |
| RF-23 | Marcar serviços individuais como `IN_PROGRESS` e `COMPLETED` | `mechanic` |
| RF-24 | Encerrar a OS quando todos os serviços estão concluídos (`EXECUTION → FINISHED`) | `mechanic` |
| RF-25 | Marcar a OS como entregue ao cliente (`FINISHED → DELIVERED`) | `attendant` |
| RF-26 | Listar OSs com filtros por `status` e `customerId` | `attendant`, `mechanic`, `admin` |
| RF-27 | Detalhar uma OS por ID | `attendant`, `mechanic`, `admin` |
| RF-28 | Calcular o tempo médio de execução das OSs concluídas | `admin` |

#### Documentação

| ID | Requisito | Ator |
|---|---|---|
| RF-29 | Expor documentação interativa da API (Swagger UI em `/docs`) | Todos |

### 1.2 Requisitos Não-Funcionais

Atributos de qualidade e como são atendidos. Cada item aponta o ponto de implementação.

#### Segurança

| ID | Requisito | Como é atendido |
|---|---|---|
| RNF-01 | Senhas armazenadas com hash forte | bcrypt com 12 rounds; nunca retornadas em responses |
| RNF-02 | Autenticação stateless | JWT com expiração de 24h; segredo via `JWT_SECRET` |
| RNF-03 | Autorização por papel | RBAC com middleware `requireRole(...)` aplicado por rota |
| RNF-04 | Headers HTTP seguros | `helmet` com CSP customizada (apenas `unsafe-inline` em `script-src` para o Swagger UI) |
| RNF-05 | CORS controlado por allowlist | Origens via env `CORS_ORIGIN` |
| RNF-06 | Mitigação de brute force em login | `express-rate-limit`: 10 req / 15 min por IP em `POST /auth/login` |
| RNF-07 | Mitigação de brute force no código de aprovação público | `express-rate-limit`: 5 req / hora por combinação IP + OS em `PATCH /service-orders/:id/budget` |
| RNF-08 | Validação de CPF/CNPJ pelos dígitos verificadores (mod 11) | `domain/validators.ts` |
| RNF-09 | Prevenção contra injeção em queries | Mongoose com queries parametrizadas; sem interpolação de string |
| RNF-10 | CPF/CNPJ tratados como dado privado | Armazenados só como dígitos; nunca devolvidos em responses de OS |
| RNF-11 | Resposta de erro sem vazamento de detalhes internos | `errorMiddleware` mapeia `AppError` → status; demais erros viram 500 genérico |

#### Confiabilidade e consistência

| ID | Requisito | Como é atendido |
|---|---|---|
| RNF-12 | Transições de estado da OS auditáveis e proibitivas a saltos inválidos | Máquina de estados explícita nos use cases (`Start*`, `Finish*`, `Approve/RejectBudget`, etc.) |
| RNF-13 | Consistência de estoque entre reserva e consumo | `Item` mantém `stockQuantity` + `reservedQuantity` no mesmo agregado; transições da OS sabem o que aplicar |
| RNF-14 | Histórico preservado mesmo após remoção de cliente | Soft delete em `Customer.deletedAt` |

#### Manutenibilidade

| ID | Requisito | Como é atendido |
|---|---|---|
| RNF-15 | Domínio independente de framework | Hexagonal: `domain/` e `application/` não importam de `infrastructure/` |
| RNF-16 | Cobertura de testes ≥ 80% (lines, branches, functions, statements) | `jest.config.ts` com `coverageThreshold`; cobertura atual ~93% |
| RNF-17 | Zero bugs e zero vulnerabilities no SonarQube | Análise estática via SonarQube Community executada localmente |
| RNF-18 | Zero vulnerabilidades em dependências | Verificado via `npm audit` (597 pacotes, 0 vulnerabilidades) |

#### Portabilidade e operação

| ID | Requisito | Como é atendido |
|---|---|---|
| RNF-19 | Ambiente reprodutível | Docker multi-stage + `docker-compose.yml` (app + MongoDB) |
| RNF-20 | Configuração externa por variáveis de ambiente | `PORT`, `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` |
| RNF-21 | Bootstrap idempotente do admin padrão | `infrastructure/persistence/seed.ts` cria admin só se `ADMIN_PASSWORD` estiver definido |

#### Interoperabilidade e usabilidade da API

| ID | Requisito | Como é atendido |
|---|---|---|
| RNF-22 | Contrato REST/JSON consistente | Bodies/responses em JSON; paths em kebab-case; transições por body (`{ status }`) |
| RNF-23 | Documentação interativa sempre alinhada ao código | `swagger-jsdoc` lê anotações nas rotas; UI em `/docs` |
| RNF-24 | Coleção Postman executável de ponta a ponta via Newman | `postman/` com collection + environment idempotentes para Collection Runner |

#### Extensibilidade

| ID | Requisito | Como é atendido |
|---|---|---|
| RNF-25 | Notificação ao cliente trocável sem mexer no domínio | Port `INotificationService` com adapter atual `ConsoleNotificationService` (mock) |
| RNF-26 | Persistência trocável sem mexer no domínio | Repositórios são interfaces (`I*Repository`) implementadas pelos adapters Mongo |

---

## 2. Restrições

| Tipo | Restrição |
|---|---|
| Acadêmica | Entrega como MVP do FIAP Tech Challenge — Fase 1 |
| Técnica | Runtime obrigatoriamente Node.js + TypeScript |
| Técnica | Empacotamento via Docker + docker-compose (ambiente reprodutível) |
| Técnica | Banco de dados MongoDB |
| Funcional | RBAC com 3 papéis fixos: `attendant`, `mechanic`, `admin` |
| Funcional | Aprovação de orçamento sem login (apenas com código derivado do CPF/CNPJ) |
| Qualidade | Cobertura de testes mínima de 80% nos domínios críticos |

---

## 3. Contexto e Escopo

### Atores e seus pontos de entrada

| Ator | Acesso | Pontos de entrada |
|---|---|---|
| `attendant` (atendente) | JWT | `/auth/login`, `/customers`, `/vehicles`, `POST /service-orders` |
| `mechanic` (mecânico) | JWT | `/auth/login`, transições da OS via `PATCH /service-orders/:id`, gestão de itens/serviços da OS |
| `admin` | JWT | Tudo + `/auth/register`, gestão de catálogo (`/services`, `/items`) |
| Cliente final | Público (sem JWT) | `GET /service-orders/:id/status`, `PATCH /service-orders/:id/budget` (com código) |

### Sistemas externos

Nenhum no MVP. O port `INotificationService` está pronto para um adapter real (e-mail/SMS) pós-MVP, mas hoje há apenas o mock `ConsoleNotificationService` que loga em stdout.

---

## 4. Estratégia de Solução

| Concern | Estratégia | Por quê |
|---|---|---|
| Estilo arquitetural | Monolito hexagonal (ports & adapters) | Isola domínio de framework; facilita troca de adapters (banco, transporte) sem mexer no domínio |
| Persistência | MongoDB + Mongoose | `ServiceOrder` é documento natural — agrupa serviços e itens que não existem fora da OS; elimina joins |
| Autenticação | JWT stateless + bcrypt | Stateless cabe no MVP; bcrypt 12 rounds protege senhas |
| Autorização | RBAC com middleware `requireRole(...)` | Papéis fixos atendem o domínio; permissões granuladas por endpoint |
| Aprovação pelo cliente | Endpoint público + código derivado do CPF/CNPJ | Evita criação de conta para o cliente final; código previsível mas dificilmente adivinhado por terceiros, com rate limit |
| Documentação da API | swagger-jsdoc + swagger-ui-express | Documentação ao lado do código; UI exploratória em `/docs` |
| Testes | Unit + Integration (Jest + Supertest + mongodb-memory-server) | Unit isola use cases; integration cobre HTTP→Mongo sem infra externa |
| Containerização | Docker multi-stage + docker-compose | Ambiente reprodutível; build separado de runtime |

---

## 5. Visão de Building Blocks (Estática)

Estrutura por camadas, refletindo a arquitetura hexagonal:

```
src/
  domain/
    entities/          # Interfaces TypeScript puras — sem acoplamento a frameworks
    ports/             # Interfaces de repositório (ICustomerRepository, etc.) e INotificationService
    errors/            # AppError, NotFoundError, ValidationError, ConflictError
    validators.ts      # Validações de CPF, CNPJ, placa — funções puras
    serviceOrderStateMachine.ts  # Transições válidas da OS — funções puras
  application/
    use-cases/         # Um arquivo por use case; depende só dos ports do domínio
    utils/             # Helpers compartilhados entre use cases (ex.: findOSOrThrow)
  infrastructure/
    http/
      routes/          # Routers Express — um por recurso
      middlewares/     # authMiddleware, roleMiddleware, errorMiddleware
    persistence/
      models/          # Schemas Mongoose
      repositories/    # Implementações dos ports do domínio
      seed.ts          # Cria o admin padrão na primeira execução
      connection.ts    # Abre/fecha conexão com Mongo
    notifications/     # Adapters de INotificationService (MVP: ConsoleNotificationService)
    swagger/           # Configuração do swagger-jsdoc
  app.ts               # Setup do Express, registro de rotas e middlewares
  main.ts              # Bootstrap, conexão com o banco, graceful shutdown
```

**Regra de dependência:** `domain/` e `application/` não importam nada de `infrastructure/`. A inversão de dependência é garantida pelas interfaces dos ports.

**Modelo de dados (entidades principais)**

```
User
  _id, email, passwordHash
  role: 'attendant' | 'mechanic' | 'admin'

Customer
  _id, name
  taxId: string        # só dígitos (CPF: 11, CNPJ: 14)
  taxType: 'CPF' | 'CNPJ'
  email, phone
  createdAt, updatedAt, deletedAt?   # soft delete

Vehicle
  _id, customerId → Customer
  plate, brand, model, year

Service
  _id, name, price, estimatedMinutes

Item
  _id, name, price
  stockQuantity        # total em estoque
  reservedQuantity     # reservado por OS em andamento
  # availableQuantity = stockQuantity - reservedQuantity (derivado)

ServiceOrder
  _id
  customerId → Customer
  vehicleId  → Vehicle
  status: OSStatus
  budgetTotal?         # calculado em DIAGNOSIS → WAITING_APPROVAL, persistido como valor fixo
  services: [{ serviceId → Service, startedAt?, finishedAt? }]
  items:    [{ itemId → Item, quantity }]
  createdAt, startedAt?, finishedAt?, deliveredAt?
```

**Observação:** `services[]` e `items[]` guardam só referências; preços são resolvidos e congelados em `budgetTotal` na transição `DIAGNOSIS → WAITING_APPROVAL`.

---

## 6. Visão de Runtime (Dinâmica)

### Máquina de estados da Ordem de Serviço

```
RECEIVED → DIAGNOSIS → WAITING_APPROVAL → APPROVED → EXECUTION → FINISHED → DELIVERED
                                        ↘ REJECTED (terminal)
```

As transições estão divididas em dois endpoints comandados pelo body:

- **Transições internas** — `PATCH /service-orders/:id` com `{ status }`. JWT, mechanic+admin.
- **Decisão de orçamento pelo cliente** — `PATCH /service-orders/:id/budget` com `{ status, code }`. Pública, rate-limited 5/h por IP+OS.

| Transição | Endpoint | Body | Ator | Efeito colateral |
|---|---|---|---|---|
| RECEIVED → DIAGNOSIS | `PATCH /service-orders/:id` | `{ status: "DIAGNOSIS" }` | mechanic, admin | — |
| DIAGNOSIS → WAITING_APPROVAL | `PATCH /service-orders/:id` | `{ status: "WAITING_APPROVAL" }` | mechanic, admin | Calcula e persiste `budgetTotal`; dispara notificação best-effort via `INotificationService` (MVP: mock `console.log`) |
| WAITING_APPROVAL → APPROVED | `PATCH /service-orders/:id/budget` | `{ status: "APPROVED", code: "..." }` | público (código 4 dígitos, rate-limited) | Reservas de itens já realizadas na abertura da OS e/ou durante o diagnóstico |
| WAITING_APPROVAL → REJECTED | `PATCH /service-orders/:id/budget` | `{ status: "REJECTED", code: "..." }` | público (código 4 dígitos, rate-limited) | Libera `reservedQuantity` de todos os itens da OS |
| APPROVED → EXECUTION | `PATCH /service-orders/:id` | `{ status: "EXECUTION" }` | mechanic, admin | Decrementa `stockQuantity` e zera `reservedQuantity` dos itens |
| EXECUTION → FINISHED | `PATCH /service-orders/:id` | `{ status: "FINISHED" }` | mechanic, admin | Grava `finishedAt` |
| FINISHED → DELIVERED | `PATCH /service-orders/:id` | `{ status: "DELIVERED" }` | mechanic, admin | Grava `deliveredAt` |

Serviços individuais da OS são atualizados via `PATCH /service-orders/:id/services/:serviceId` com `{ status: "IN_PROGRESS" | "COMPLETED" }` (grava `startedAt`/`finishedAt`).

- `DELETE /service-orders/:id/services/:serviceId` — remove serviço da OS em diagnóstico (mechanic, admin)
- `DELETE /service-orders/:id/items/:itemId` — remove peça da OS em diagnóstico, libera estoque (mechanic, admin)

### Fluxo de aprovação pelo cliente

1. Mecânico encerra o diagnóstico (`DIAGNOSIS → WAITING_APPROVAL`).
2. Sistema calcula `budgetTotal` e dispara `INotificationService` (mock loga em stdout).
3. Cliente consulta o status pela rota pública `GET /service-orders/:id/status`.
4. Cliente envia decisão em `PATCH /service-orders/:id/budget` com `{ status, code }`. O `code` são os 4 primeiros dígitos do CPF/CNPJ.
5. Rejeição libera o `reservedQuantity` de todos os itens da OS; aprovação não altera estoque (reservas já foram feitas).

### Reserva de estoque

- `POST /service-orders` com `items[]` → incrementa `reservedQuantity` de cada peça informada
- `add-item-to-OS` (DIAGNOSIS) → incrementa `reservedQuantity`
- `remove-item-from-OS` (DIAGNOSIS) → decrementa `reservedQuantity`
- transição `EXECUTION` → decrementa `stockQuantity`, zera `reservedQuantity`
- transição `REJECTED` → decrementa `reservedQuantity` (libera reserva de todos os itens)

---

## 7. Visão de Deployment

### Topologia local

```
┌─────────────────┐        ┌─────────────────┐
│   API (Node)    │  →     │  MongoDB 7      │
│   :3000         │        │  :27017         │
└─────────────────┘        └─────────────────┘
       ↑                            ↑
       └─ docker-compose ───────────┘
```

**Profile opcional `sonar`** acrescenta dois serviços só para análise estática (não sobem por padrão):

```
┌─────────────────┐        ┌─────────────────┐
│  SonarQube 10   │  →     │ PostgreSQL 15   │
│  :9000          │        │ (sonar-db)      │
└─────────────────┘        └─────────────────┘
```

### Comandos

```bash
# Subir o ambiente da aplicação
docker-compose up --build

# Subir SonarQube (opcional)
docker-compose --profile sonar up -d sonarqube sonar-db

# Build da imagem da app
docker build -t car-repair-shop-api .
```

**Dockerfile:** multi-stage — estágio `builder` compila o TypeScript; estágio `runtime` copia só `dist/` e instala dependências de produção.

### Variáveis de ambiente

| Variável | Descrição | Obrigatória |
|---|---|---|
| `PORT` | Porta da aplicação (default `3000`) | Não |
| `MONGODB_URI` | URI de conexão com o MongoDB | Sim |
| `JWT_SECRET` | Segredo para assinar tokens | Sim |
| `CORS_ORIGIN` | Origens CORS permitidas (separadas por vírgula) | Não |
| `ADMIN_EMAIL` | Email do admin padrão (default `admin@master.com`) | Não |
| `ADMIN_PASSWORD` | Senha do admin padrão; se vazio, seed é pulado | Não |
| `SONAR_HOST_URL` | URL do servidor SonarQube | Não |
| `SONAR_TOKEN` | Token gerado na UI do SonarQube | Não |

---

## 8. Conceitos Transversais

### Tratamento de erros

Hierarquia em `src/domain/errors/AppError.ts`:

- `AppError` (base, com `statusCode`)
- `NotFoundError` (404)
- `ValidationError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `ConflictError` (409)

Capturados centralmente em `errorMiddleware`, que mapeia `statusCode` e `message` para a response. Erros não esperados retornam 500 sem vazar detalhes.

### Segurança

- **JWT** com expiração de 24h; segredo via `JWT_SECRET`.
- **Senhas** com bcrypt (12 rounds); nunca devolvidas em responses.
- **CPF/CNPJ** armazenados só como dígitos; validação de dígitos verificadores (mod 11) em `domain/validators.ts`.
- **Helmet** habilitado com CSP customizado (`script-src 'self' 'unsafe-inline'` para o Swagger UI).
- **Rate limiting** via `express-rate-limit`:
  - `POST /auth/login`: 10 req / 15 min por IP.
  - `PATCH /service-orders/:id/budget` (público): 5 req / hora por combinação IP+OS.
- **CORS** com allowlist via `CORS_ORIGIN`.
- **Queries** parametrizadas pelo Mongoose — sem interpolação de string.

### Convenções da API

- Bodies e responses em JSON; `Content-Type: application/json`.
- Paths em kebab-case (`/service-orders`).
- Transições por body (`{ status }`) em vez de path com verbo.
- IDs no path; filtros via query string.

### Seed de boot

- `infrastructure/persistence/seed.ts` cria o admin padrão na primeira execução, lendo `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
- Se `ADMIN_PASSWORD` está vazio, o seed é pulado e um warning é logado.

---

## 9. Decisões Principais

| # | Decisão | Alternativa descartada | Razão |
|---|---|---|---|
| 1 | Hexagonal (ports & adapters) | MVC clássico | Isola domínio de Express/Mongoose; facilita testes unitários sem framework |
| 2 | MongoDB | PostgreSQL | OS é documento natural (services e items pertencem a ela); evita joins |
| 3 | JWT stateless | Sessão server-side | Cabe num MVP; sem estado compartilhado |
| 4 | Aprovação por código de 4 dígitos | Login do cliente | Reduz fricção para o cliente final; aceita o risco residual de adivinhação contra rate limit |
| 5 | RBAC fixo (3 papéis) | RBAC dinâmico / ABAC | Domínio tem 3 perfis bem definidos; complexidade adicional não se paga |
| 6 | Notificação como port com mock | Implementação real (e-mail/SMS) | MVP foca o fluxo de domínio; transporte real é troca de adapter |
| 7 | Estoque com `stockQuantity` + `reservedQuantity` | Reserva fora da entidade Item | Mantém consistência num único agregado; transições da OS sabem o que fazer |
| 8 | Cobertura mínima 80% | 95% | Realista incluindo a camada de infra; foco em testes que importam |

---

## 10. Qualidade e Testes

### Estratégia

- **Unitários** (`tests/unit/`): camada de use case; repositórios mockados via interfaces de port; sem banco real.
- **Integração** (`tests/integration/`): camada HTTP via Supertest contra `mongodb-memory-server`; sem infra externa.

### Convenções

- Descrições de teste seguem o padrão **GIVEN / WHEN / THEN**.
- Fixtures compartilhadas em `tests/unit/fixtures/` (objetos de domínio + factories de mock).

### Cobertura

- Meta: ≥ 80% (lines, branches, functions, statements).
- Configurada em `jest.config.ts` via `coverageThreshold`.
- Excluídos por serem bootstrap/configuração: `src/main.ts`, `src/app.ts`, `src/infrastructure/swagger/**`, `src/infrastructure/persistence/connection.ts`, `src/infrastructure/persistence/seed.ts`, `src/infrastructure/persistence/models/**`. As mesmas exclusões aparecem em `sonar-project.properties` (`sonar.coverage.exclusions`) para os números baterem.

### Análise estática

- SonarQube local (profile `sonar` no docker-compose).
- Scanner roda via Docker (`sonarsource/sonar-scanner-cli`) — sem dependência de Java no host.
- `npm run test:coverage && npm run sonar` envia o relatório para o servidor local.

### Comandos

```bash
npm test                  # todos os testes
npm run test:coverage     # com relatório de cobertura
npm run sonar             # análise SonarQube (requer servidor local + token no .env)
```

---

## 11. Riscos e Dívidas Técnicas

| # | Item | Estado | Impacto |
|---|---|---|---|
| 1 | Notificação ao cliente é mock (`console.log`) | Conhecido — port pronto para adapter real | Cliente não recebe notificação efetiva; depende de consultar `/status` ativamente |
| 2 | Code de aprovação derivado do CPF/CNPJ | Aceito + rate limit | Adivinhação possível em 4 dígitos; mitigado por 5 req/h por IP+OS |
| 3 | Hotspot do SonarQube: `'unsafe-inline'` no CSP | Aceito — necessário para Swagger UI | Marcado como Safe na revisão; não afeta a API em si |

---

## 12. Glossário

Termos do domínio, atores e status da OS estão em [`docs/ddd/ubiquitous-language.md`](ddd/ubiquitous-language.md).

Diagramas de DDD em `docs/ddd/`: Event Storming (`event-storming.png`), Linguagem Pictográfica (`linguagem-pictografica.png`).
