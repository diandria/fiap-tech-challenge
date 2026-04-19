# Architecture — Car Repair Shop API

**Projeto:** FIAP Tech Challenge — Fase 1  
**Versao:** 1.0 (MVP)  
**Stack:** Node.js + TypeScript + Express + MongoDB

---

## 1. Contexto

MVP de back-end para uma oficina mecanica de medio porte. Substitui anotacoes manuais e planilhas por um sistema integrado que gerencia clientes, veiculos, ordens de servico e estoque de pecas.

**Problema central:** ordens de servico sem rastreabilidade — sem historico de cliente, sem controle de pecas, sem visibilidade de status.

**Solucao:** API REST monolitica com estado auditavel da OS, aprovacao de orcamento pelo cliente via codigo de verificacao, e controle de reserva de estoque ao longo do ciclo de vida da OS.

---

## 2. Stack e Decisoes

| Preocupacao | Escolha | Justificativa |
|---|---|---|
| Runtime | Node.js + TypeScript | Tipagem estatica previne erros de dominio; async nativo adequado para IO-bound |
| HTTP | Express | Minimal, sem opiniao sobre estrutura — compativel com arquitetura hexagonal |
| Banco de dados | MongoDB + Mongoose | ServiceOrder e um documento natural — possui servicos e itens proprios sem vida fora do contexto da OS; elimina joins |
| Auth | jsonwebtoken + bcryptjs | JWT stateless adequado para MVP; bcrypt com 12 rounds para senhas |
| API Docs | swagger-jsdoc + swagger-ui-express | Documentacao proxima ao codigo; suporte a JSDoc inline nas rotas |
| Testes | Jest + ts-jest + Supertest + mongodb-memory-server | Testes unitarios sem dependencia de banco; integracao sem infra externa |
| Container | Docker + docker-compose | Reproducibilidade de ambiente; requisito do projeto |
| Rate limiting | express-rate-limit | Protecao contra brute force em login e aprovacao de orcamento |

---

## 3. Arquitetura — Hexagonal Simples

```
src/
  domain/
    entities/          # Interfaces TypeScript puras — sem acoplamento a frameworks
    ports/             # Interfaces de repositorio (ICustomerRepository, etc.)
    errors/            # AppError, NotFoundError, ValidationError
    validators.ts      # Validacao de CPF, CNPJ, placa — funcoes puras
    serviceOrderStateMachine.ts  # Transicoes validas da OS — funcoes puras
  application/
    use-cases/         # Um arquivo por caso de uso; depende apenas de portas do dominio
  infrastructure/
    http/
      routes/          # Express routers — um por recurso
      middlewares/     # authMiddleware, roleMiddleware, errorMiddleware
    persistence/
      models/          # Schemas Mongoose
      repositories/    # Implementacoes das portas do dominio
      seed.ts          # Cria admin padrao na primeira execucao
    swagger/           # Configuracao do swagger-jsdoc
  app.ts               # Setup Express, registro de rotas
  main.ts              # Bootstrap, conexao com banco, graceful shutdown
```

**Regra de dependencia:** `domain/` e `application/` nao importam nada de `infrastructure/`. A inversao de dependencia e garantida pelas interfaces de porta.

**Por que isso importa para proximas fases:** adicionar um novo banco, uma fila de mensagens ou um novo canal de entrega exige apenas uma nova implementacao de porta — os casos de uso nao mudam.

---

## 4. Modelo de Dados

### Entidades e relacionamentos

```
User
  _id, email, passwordHash
  role: 'attendant' | 'mechanic' | 'admin'

Customer
  _id, name
  taxId: string        # digitos apenas (CPF: 11, CNPJ: 14)
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
  reservedQuantity     # reservado para OS em andamento
  # availableQuantity = stockQuantity - reservedQuantity (derivado, nao armazenado)

ServiceOrder
  _id
  customerId → Customer
  vehicleId  → Vehicle
  status: OSStatus
  budgetTotal?         # calculado no finish-diagnosis, armazenado como valor fixo
  services: [{ serviceId → Service, startedAt?, finishedAt? }]
  items:    [{ itemId → Item, quantity }]
  createdAt, startedAt?, finishedAt?, deliveredAt?
```

**Nota:** `services[]` e `items[]` armazenam apenas referencias (`serviceId`, `itemId`). Os precos sao resolvidos no momento do `finish-diagnosis` e armazenados em `budgetTotal` — preco fixado no momento do orcamento, imune a alteracoes futuras no catalogo.

---

## 5. State Machine — Ordem de Servico

```
RECEIVED → DIAGNOSIS → WAITING_APPROVAL → APPROVED → EXECUTION → FINISHED → DELIVERED
                                        ↘ REJECTED (terminal)
```

| Transicao | Comando (endpoint) | Ator | Efeito colateral |
|---|---|---|---|
| RECEIVED → DIAGNOSIS | `PATCH start-diagnosis` | attendant, admin | — |
| DIAGNOSIS → WAITING_APPROVAL | `PATCH finish-diagnosis` | attendant, admin | Calcula e armazena `budgetTotal` |
| WAITING_APPROVAL → APPROVED | `POST approve-budget` | publico (codigo 4 digitos) | Reserva de itens ja feita no add-item |
| WAITING_APPROVAL → REJECTED | `POST reject-budget` | publico (codigo 4 digitos) | Libera `reservedQuantity` de todos os itens da OS |
| APPROVED → EXECUTION | `PATCH start-execution` | mechanic, admin | Decrementa `stockQuantity` e zera `reservedQuantity` dos itens da OS |
| EXECUTION → FINISHED | `PATCH finish` | mechanic, admin | Registra `finishedAt` |
| FINISHED → DELIVERED | `PATCH deliver` | mechanic, admin | Registra `deliveredAt` |

**Codigo de aprovacao:** primeiros 4 digitos do CPF ou CNPJ do cliente. Nao e enviado ativamente no MVP — o cliente consulta status via endpoint publico e usa o codigo que ja conhece.

**Reserva de estoque:**
- `add-item-to-OS` → incrementa `reservedQuantity`
- `remove-item-from-OS` → decrementa `reservedQuantity`
- `start-execution` → decrementa `stockQuantity`, zera `reservedQuantity`
- `reject-budget` → decrementa `reservedQuantity` (libera reserva)

---

## 6. API — Endpoints

### Auth
| Metodo | Rota | Acesso | Descricao |
|---|---|---|---|
| POST | /auth/login | publico | Autentica e retorna JWT |
| POST | /auth/register | admin | Cria novo usuario |

### Customers
| Metodo | Rota | Acesso | Descricao |
|---|---|---|---|
| GET | /customers | autenticado | Lista clientes |
| POST | /customers | attendant, admin | Cria cliente |
| GET | /customers/:id | autenticado | Busca por ID |
| GET | /customers/tax/:taxId | autenticado | Busca por CPF/CNPJ |
| PUT | /customers/:id | attendant, admin | Atualiza cliente |
| DELETE | /customers/:id | attendant, admin | Soft delete |

### Vehicles
| Metodo | Rota | Acesso | Descricao |
|---|---|---|---|
| GET | /vehicles | autenticado | Lista (filtro: ?customerId=) |
| POST | /vehicles | attendant, admin | Cadastra veiculo |
| GET | /vehicles/:id | autenticado | Busca por ID |
| PUT | /vehicles/:id | attendant, admin | Atualiza veiculo |
| DELETE | /vehicles/:id | attendant, admin | Remove veiculo |

### Services (catalogo)
| Metodo | Rota | Acesso | Descricao |
|---|---|---|---|
| GET | /services | autenticado | Lista servicos do catalogo |
| POST | /services | admin | Cria servico |
| GET | /services/:id | autenticado | Busca por ID |
| PUT | /services/:id | admin | Atualiza servico |
| DELETE | /services/:id | admin | Remove servico |

### Items (estoque)
| Metodo | Rota | Acesso | Descricao |
|---|---|---|---|
| GET | /items | autenticado | Lista itens |
| POST | /items | admin | Cria item |
| GET | /items/:id | autenticado | Busca por ID |
| PUT | /items/:id | admin | Atualiza item |
| DELETE | /items/:id | admin | Remove item |

### Service Orders
| Metodo | Rota | Acesso | Descricao |
|---|---|---|---|
| GET | /service-orders/:id/status | publico | Status e budgetTotal da OS |
| POST | /service-orders/:id/approve-budget | publico, rate-limited | Aprova orcamento |
| POST | /service-orders/:id/reject-budget | publico, rate-limited | Rejeita orcamento |
| GET | /service-orders | autenticado | Lista OS (filtros: status, customerId, from, to) |
| POST | /service-orders | attendant, admin | Cria OS |
| GET | /service-orders/:id | autenticado | Detalha OS |
| POST | /service-orders/:id/services | mechanic, admin | Adiciona servico a OS ¹ |
| DELETE | /service-orders/:id/services/:serviceId | mechanic, admin | Remove servico da OS ¹ |
| POST | /service-orders/:id/items | mechanic, admin | Adiciona item a OS ¹ |
| DELETE | /service-orders/:id/items/:itemId | mechanic, admin | Remove item da OS ¹ |
| PATCH | /service-orders/:id/start-diagnosis | attendant, admin | Inicia diagnostico |
| PATCH | /service-orders/:id/finish-diagnosis | attendant, admin | Finaliza diagnostico e gera orcamento |
| PATCH | /service-orders/:id/start-execution | mechanic, admin | Inicia execucao |
| PATCH | /service-orders/:id/services/:serviceId/start | mechanic, admin | Inicia servico individual |
| PATCH | /service-orders/:id/services/:serviceId/finish | mechanic, admin | Finaliza servico individual |
| PATCH | /service-orders/:id/finish | mechanic, admin | Finaliza OS |
| PATCH | /service-orders/:id/deliver | mechanic, admin | Entrega OS |

¹ _Role correta conforme Event Storming. Codigo atual usa `attendant` — bug pendente de correcao (ver Gaps #1)._

---

## 7. Seguranca

### Autenticacao e autorizacao
- JWT com expiracao de 24h; secret via env var `JWT_SECRET`
- RBAC com 3 roles: `attendant`, `mechanic`, `admin`
- `authMiddleware` valida o token em todas as rotas autenticadas
- `requireRole(...roles)` valida permissao por acao

### Rate limiting
- `POST /auth/login`: 10 req / 15 min por IP
- `POST /service-orders/:id/approve-budget` e `reject-budget`: 5 req / hora por combinacao IP + OS ID

### Validacao de dados sensiveis
- CPF: 11 digitos + validacao dos dois digitos verificadores (mod 11)
- CNPJ: 14 digitos + validacao dos dois digitos verificadores (mod 11)
- Placa: formato antigo (`ABC-1234`) e Mercosul (`ABC1D23`)
- Todas as validacoes em funcoes puras em `domain/validators.ts`

### Boas praticas OWASP
- Senhas: bcrypt com 12 rounds; nunca retornadas em responses
- CPF/CNPJ: armazenado apenas como digitos; nunca retornado em responses de OS
- Queries: Mongoose parametrizado — sem interpolacao de strings
- CORS: allowlist via env var `CORS_ORIGIN`
- Headers de seguranca: configurar `helmet` nas proximas fases

### Seed do admin padrao
- Criado na primeira inicializacao via `infrastructure/persistence/seed.ts`
- Email: `ADMIN_EMAIL` (env var) — fallback: `admin@master.com`
- Senha: `ADMIN_PASSWORD` (env var) — **nao deve usar o fallback em producao**

---

## 8. Testes

### Estrategia
- **Unitarios** (`tests/unit/`): camada de casos de uso; repositorios mockados via interfaces de porta; sem banco real
- **Integracao** (`tests/integration/`): camada HTTP via Supertest contra `mongodb-memory-server`; sem infra externa

### Convencoes
- Descricoes de testes seguem o padrao **GIVEN / WHEN / THEN**
- Fixtures compartilhadas em `tests/unit/fixtures/` (domain objects + factory functions de mocks)

### Cobertura
- Meta: >= 80% nos dominios criticos (casos de uso, state machine, validators)
- Configurado em `jest.config.ts` com `coverageThreshold`

### Executar
```bash
npm test                  # todos os testes
npm run test:coverage     # com relatorio de cobertura
```

---

## 9. Infraestrutura

### Variaveis de ambiente

| Variavel | Descricao | Exemplo |
|---|---|---|
| `MONGO_URI` | URI de conexao MongoDB | `mongodb://mongo:27017/repair-shop` |
| `JWT_SECRET` | Secret para assinar tokens | string aleatoria longa |
| `JWT_EXPIRES_IN` | Expiracao do token | `24h` |
| `CORS_ORIGIN` | Origem permitida no CORS | `http://localhost:3000` |
| `PORT` | Porta da aplicacao | `3000` |
| `ADMIN_EMAIL` | Email do admin de seed | `admin@master.com` |
| `ADMIN_PASSWORD` | Senha do admin de seed | — nao usar padrao em producao — |

### Docker
```bash
# Subir ambiente completo (app + MongoDB)
docker-compose up --build

# Build da imagem isolada
docker build -t car-repair-shop-api .
```

**Dockerfile:** multi-stage — stage `builder` compila TypeScript; stage `runtime` copia apenas `dist/` e instala dependencias de producao.

### Swagger UI
Disponivel em `/docs` quando a aplicacao estiver rodando.

---

## 10. Gaps e Proximos Passos

Itens identificados no diagnostico da Fase 1 para implementar nas proximas fases:

| # | Item | Prioridade |
|---|---|---|
| 1 | **Role correta para add-service/add-item** — codigo atual permite `attendant`; deve ser `mechanic` conforme Event Storming | Alta |
| 2 | **Endpoint de tempo medio de execucao** — dados existem (`startedAt`/`finishedAt` em `OSService`); falta endpoint `GET /service-orders/stats/avg-execution` | Alta |
| 3 | **SonarQube** — adicionar `sonar-project.properties` e script de analise | Alta |
| 4 | **Relatorio de vulnerabilidades** — executar `npm audit` e documentar resultado | Alta |
| 5 | **Testes: GIVEN/WHEN/THEN** — reescrever descricoes dos testes unitarios | Media |
| 6 | **Refactoring DRY** — extrair `findOSOrThrow` e `verifyCustomerCode` para `application/utils/` | Media |
| 7 | **Fixtures de teste** — criar `tests/unit/fixtures/` com factories compartilhadas | Media |
| 8 | **Senha do admin via env var** — `ADMIN_PASSWORD` obrigatorio; remover fallback hardcoded | Alta |
| 9 | **helmet** — adicionar headers de seguranca HTTP | Media |
