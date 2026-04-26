# Arquitetura — Car Repair Shop API

**Projeto:** FIAP Tech Challenge — Fase 1
**Versão:** 1.0 (MVP)
**Stack:** Node.js + TypeScript + Express + MongoDB

---

## 1. Contexto

MVP de backend para uma oficina mecânica de médio porte. Substitui anotações manuais e planilhas por um sistema integrado que gerencia clientes, veículos, ordens de serviço e estoque de peças.

**Problema central:** ordens de serviço sem rastreabilidade — sem histórico do cliente, sem controle de peças, sem visibilidade de status.

**Solução:** API REST monolítica com estado de OS auditável, aprovação de orçamento pelo cliente via código de verificação e reserva de estoque acompanhada ao longo do ciclo de vida da OS.

---

## 2. Stack e Decisões

| Tema | Escolha | Razão |
|---|---|---|
| Runtime | Node.js + TypeScript | Tipagem estática evita erros de domínio; async nativo encaixa com trabalho IO-bound |
| HTTP | Express | Mínimo, sem opinião sobre estrutura — compatível com arquitetura hexagonal |
| Banco | MongoDB + Mongoose | ServiceOrder é um documento natural — agrupa serviços e itens que não existem fora da OS; elimina joins |
| Auth | jsonwebtoken + bcryptjs | JWT stateless cabe no MVP; bcrypt com 12 rounds para senhas |
| Docs API | swagger-jsdoc + swagger-ui-express | Documentação ao lado do código; suporta JSDoc inline nas rotas |
| Testes | Jest + ts-jest + Supertest + mongodb-memory-server | Unitários sem dependência de banco; integração sem infra externa |
| Container | Docker + docker-compose | Ambiente reprodutível; requisito do projeto |
| Rate limiting | express-rate-limit | Protege login e aprovação de orçamento contra brute force |

---

## 3. Arquitetura — Hexagonal Simples

```
src/
  domain/
    entities/          # Interfaces TypeScript puras — sem acoplamento a frameworks
    ports/             # Interfaces de repositório (ICustomerRepository, etc.)
    errors/            # AppError, NotFoundError, ValidationError
    validators.ts      # Validações de CPF, CNPJ, placa — funções puras
    serviceOrderStateMachine.ts  # Transições válidas da OS — funções puras
  application/
    use-cases/         # Um arquivo por use case; depende só dos ports do domínio
  infrastructure/
    http/
      routes/          # Routers Express — um por recurso
      middlewares/     # authMiddleware, roleMiddleware, errorMiddleware
    persistence/
      models/          # Schemas Mongoose
      repositories/    # Implementações dos ports do domínio
      seed.ts          # Cria o admin padrão na primeira execução
    notifications/     # Adapters de INotificationService (MVP: mock console-log)
    swagger/           # Configuração do swagger-jsdoc
  app.ts               # Setup do Express, registro de rotas
  main.ts              # Bootstrap, conexão com o banco, graceful shutdown
```

**Regra de dependência:** `domain/` e `application/` não importam nada de `infrastructure/`. A inversão de dependência é garantida pelas interfaces dos ports.

**Por que isso importa para fases futuras:** trocar de banco, adicionar uma fila de mensagens ou um novo canal de entrega exige só uma nova implementação de port — os use cases não mudam.

---

## 4. Modelo de Dados

### Entidades e relacionamentos

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
  _id
  customerId → Customer
  plate, brand, model, year

Service
  _id, name, price, estimatedMinutes

Item
  _id, name, price
  stockQuantity        # total em estoque
  reservedQuantity     # reservado por OS em andamento
  # availableQuantity = stockQuantity - reservedQuantity (derivado, não persistido)

ServiceOrder
  _id
  customerId → Customer
  vehicleId  → Vehicle
  status: OSStatus
  budgetTotal?         # calculado na transição DIAGNOSIS -> WAITING_APPROVAL, persistido como valor fixo
  services: [{ serviceId → Service, startedAt?, finishedAt? }]
  items:    [{ itemId → Item, quantity }]
  createdAt, startedAt?, finishedAt?, deliveredAt?
```

**Observação:** `services[]` e `items[]` guardam só referências (`serviceId`, `itemId`). Os preços são resolvidos na transição `DIAGNOSIS → WAITING_APPROVAL` e gravados em `budgetTotal` — preço congelado no momento do orçamento, imune a mudanças futuras no catálogo.

---

## 5. Máquina de Estados — Service Order

```
RECEIVED → DIAGNOSIS → WAITING_APPROVAL → APPROVED → EXECUTION → FINISHED → DELIVERED
                                        ↘ REJECTED (terminal)
```

As transições da OS estão divididas em dois endpoints comandados pelo body:

- **Transições internas** — `PATCH /service-orders/:id` com `{ status }`. JWT, mechanic+admin.
- **Decisão de orçamento pelo cliente** — `PATCH /service-orders/:id/budget` com `{ status, code }`. Pública, rate-limited 5/h por IP+OS.

| Transição | Endpoint | Body | Ator | Efeito colateral |
|---|---|---|---|---|
| RECEIVED → DIAGNOSIS | `PATCH /service-orders/:id` | `{ status: "DIAGNOSIS" }` | mechanic, admin | — |
| DIAGNOSIS → WAITING_APPROVAL | `PATCH /service-orders/:id` | `{ status: "WAITING_APPROVAL" }` | mechanic, admin | Calcula e persiste `budgetTotal`; dispara notificação best-effort ao cliente via `INotificationService` (MVP: mock `console.log`) |
| WAITING_APPROVAL → APPROVED | `PATCH /service-orders/:id/budget` | `{ status: "APPROVED", code: "..." }` | público (código 4 dígitos, rate-limited) | Reservas de itens já feitas no add-item |
| WAITING_APPROVAL → REJECTED | `PATCH /service-orders/:id/budget` | `{ status: "REJECTED", code: "..." }` | público (código 4 dígitos, rate-limited) | Libera `reservedQuantity` de todos os itens da OS |
| APPROVED → EXECUTION | `PATCH /service-orders/:id` | `{ status: "EXECUTION" }` | mechanic, admin | Decrementa `stockQuantity` e zera `reservedQuantity` dos itens da OS |
| EXECUTION → FINISHED | `PATCH /service-orders/:id` | `{ status: "FINISHED" }` | mechanic, admin | Grava `finishedAt` |
| FINISHED → DELIVERED | `PATCH /service-orders/:id` | `{ status: "DELIVERED" }` | mechanic, admin | Grava `deliveredAt` |

Serviços individuais da OS são atualizados via `PATCH /service-orders/:id/services/:serviceId` com `{ status: "IN_PROGRESS" | "COMPLETED" }` (grava `startedAt`/`finishedAt`).

**Código de aprovação:** primeiros 4 dígitos do CPF ou CNPJ do cliente. Não é enviado ativamente no MVP — o cliente consulta o status da OS pelo endpoint público e usa o código que já conhece.

**Reserva de estoque:**
- `add-item-to-OS` → incrementa `reservedQuantity`
- `remove-item-from-OS` → decrementa `reservedQuantity`
- transição `EXECUTION` → decrementa `stockQuantity`, zera `reservedQuantity`
- transição `REJECTED` → decrementa `reservedQuantity` (libera reserva)

---

## 6. API — Endpoints

### Auth
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | /auth/login | público | Autentica e retorna JWT |
| POST | /auth/register | admin | Cria um novo usuário |

### Customers
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | /customers | autenticado | Lista clientes |
| POST | /customers | attendant, admin | Cria cliente |
| GET | /customers/:id | autenticado | Busca por ID |
| GET | /customers/tax/:taxId | autenticado | Busca por CPF/CNPJ |
| PUT | /customers/:id | attendant, admin | Atualiza cliente |
| DELETE | /customers/:id | attendant, admin | Soft delete |

### Vehicles
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | /vehicles | autenticado | Lista (filtro: `?customerId=`) |
| POST | /vehicles | attendant, admin | Cria veículo |
| GET | /vehicles/:id | autenticado | Busca por ID |
| PUT | /vehicles/:id | attendant, admin | Atualiza veículo |
| DELETE | /vehicles/:id | attendant, admin | Remove veículo |

### Services (catálogo)
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | /services | autenticado | Lista serviços do catálogo |
| POST | /services | admin | Cria serviço |
| GET | /services/:id | autenticado | Busca por ID |
| PUT | /services/:id | admin | Atualiza serviço |
| DELETE | /services/:id | admin | Remove serviço |

### Items (estoque)
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | /items | autenticado | Lista itens |
| POST | /items | admin | Cria item |
| GET | /items/:id | autenticado | Busca por ID |
| PUT | /items/:id | admin | Atualiza item |
| DELETE | /items/:id | admin | Remove item |

### Service Orders
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | /service-orders | autenticado | Lista OS (filtros: status, customerId, from, to) |
| POST | /service-orders | attendant, admin | Cria OS |
| GET | /service-orders/:id | autenticado | Detalhe da OS |
| GET | /service-orders/stats/avg-execution | autenticado (attendant, admin) | Tempo médio de execução agrupado por serviço |
| GET | /service-orders/:id/status | público | Status da OS e `budgetTotal` |
| POST | /service-orders/:id/services | mechanic, admin | Adiciona serviço à OS |
| DELETE | /service-orders/:id/services/:serviceId | mechanic, admin | Remove serviço da OS |
| POST | /service-orders/:id/items | mechanic, admin | Adiciona item à OS |
| DELETE | /service-orders/:id/items/:itemId | mechanic, admin | Remove item da OS |
| PATCH | /service-orders/:id | mechanic, admin | Transição interna comandada por `{ status }` no body |
| PATCH | /service-orders/:id/budget | público, rate-limited | Decisão de orçamento via `{ status: "APPROVED" \| "REJECTED", code }` no body |
| PATCH | /service-orders/:id/services/:serviceId | mechanic, admin | Transição por serviço via `{ status: "IN_PROGRESS" \| "COMPLETED" }` no body |

---

## 7. Segurança

### Autenticação e autorização
- JWT com expiração de 24h; segredo via env var `JWT_SECRET`
- RBAC com 3 papéis: `attendant`, `mechanic`, `admin`
- `authMiddleware` valida o token em toda rota autenticada
- `requireRole(...roles)` aplica permissões por ação

### Rate limiting
- `POST /auth/login`: 10 req / 15 min por IP
- `PATCH /service-orders/:id/budget` (público): 5 req / hora por combinação IP + ID da OS

### Validação de dados sensíveis
- CPF: 11 dígitos + validação dos 2 dígitos verificadores (mod 11)
- CNPJ: 14 dígitos + validação dos 2 dígitos verificadores (mod 11)
- Placa: formato antigo (`ABC-1234`) e Mercosul (`ABC1D23`)
- Toda validação fica como função pura em `domain/validators.ts`

### Boas práticas OWASP
- Senhas: bcrypt com 12 rounds; nunca devolvidas nas responses
- CPF/CNPJ: armazenados só como dígitos; nunca devolvidos nas responses de OS
- Queries: parametrizadas via Mongoose — sem interpolação de string
- CORS: allowlist via env var `CORS_ORIGIN`
- Headers de segurança: `helmet` habilitado

### Seed do admin padrão
- Criado no primeiro startup via `infrastructure/persistence/seed.ts`
- Email: `ADMIN_EMAIL` (env var) — fallback: `admin@master.com`
- Senha: `ADMIN_PASSWORD` (env var) — **não confie em fallback em produção**

---

## 8. Testes

### Estratégia
- **Unitários** (`tests/unit/`): camada de use case; repositórios mockados via interfaces de port; sem banco real
- **Integração** (`tests/integration/`): camada HTTP via Supertest contra `mongodb-memory-server`; sem infra externa

### Convenções
- Descrições de teste seguem o padrão **GIVEN / WHEN / THEN**
- Fixtures compartilhadas em `tests/unit/fixtures/` (objetos de domínio + factories de mock)

### Cobertura
- Meta: ≥ 80% nos domínios críticos (use cases, máquina de estados, validators)
- Configurada em `jest.config.ts` via `coverageThreshold`

### Executar
```bash
npm test                  # todos os testes
npm run test:coverage     # com relatório de cobertura
```

---

## 9. Infraestrutura

### Variáveis de ambiente

| Variável | Descrição | Exemplo |
|---|---|---|
| `MONGO_URI` | URI de conexão com o MongoDB | `mongodb://mongo:27017/repair-shop` |
| `JWT_SECRET` | Segredo usado para assinar tokens | string longa e aleatória |
| `JWT_EXPIRES_IN` | Expiração do token | `24h` |
| `CORS_ORIGIN` | Origem CORS permitida | `http://localhost:3000` |
| `PORT` | Porta da aplicação | `3000` |
| `ADMIN_EMAIL` | Email do admin padrão | `admin@master.com` |
| `ADMIN_PASSWORD` | Senha do admin padrão | — não use default em produção — |

### Docker
```bash
# Sobe o ambiente completo (app + MongoDB)
docker-compose up --build

# Build da imagem isolada
docker build -t car-repair-shop-api .
```

**Dockerfile:** multi-stage — estágio `builder` compila o TypeScript; estágio `runtime` copia só `dist/` e instala as dependências de produção.

### Swagger UI
Disponível em `/docs` quando a aplicação está rodando.

---

## 10. Gaps e Próximos Passos

Itens identificados na revisão da Fase 1. Todos foram tratados em branches dedicadas.

| # | Item | Status |
|---|---|---|
| 1 | **Notificação ao cliente em `DIAGNOSIS → WAITING_APPROVAL`** — port `INotificationService` + adapter mock `ConsoleNotificationService`; best-effort, nunca faz rollback da transição | Concluído (mock; pronto para um adapter real pós-MVP) |
