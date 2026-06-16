# Phase 2 — Milestones

## M0 — Migração para Clean Architecture

**Contexto:** O código atual usa Hexagonal Architecture (Ports & Adapters). Clean Architecture formaliza a Dependency Rule com quatro anéis concêntricos explícitos: dependências sempre apontam para dentro. A camada de fora pode depender da de dentro, nunca o contrário.

**Referência de aula:** A diferença central em relação ao Hexagonal é que o Hexagonal tem um anel externo único, enquanto o Clean Architecture divide esse anel em dois: Interface Adapters (Controllers, Presenters, Gateways) e Frameworks & Drivers (Express, Mongoose, configuração).

**Estrutura alvo:**

```
src/
  entities/                   # Enterprise Business Rules — anel mais interno
    errors/
  use-cases/                  # Application Business Rules
    ports/                    # Output Ports — interfaces definidas pelos use cases
    auth/
    customers/
    vehicles/
    services/
    items/
    service-orders/
    utils/
  adapters/                   # Interface Adapters — Controllers, Presenters, Gateways
    controllers/
    presenters/
    gateways/
    services/
  frameworks/                 # Frameworks & Drivers — anel mais externo
    http/
      middlewares/
      routes/
      swagger/
    database/
      models/
```

**Regras de interação que guiam a migração (aula):**
- Componentes de camada interna **nunca** importam de camada externa
- Quando um use case precisa de um recurso externo (DB, email), ele declara uma interface (Output Port); a implementação concreta fica em camada externa e é injetada
- Componentes da mesma camada podem se referenciar diretamente
- `main.ts` é o único ponto onde dependências concretas são instanciadas (Composition Root)

**Anti-padrões a evitar (aula):**
- Entidades como "data classes" inerte — entidades devem ter dados + regras + restrições
- Mapeamento 1:1 de entidade para schema de DB — acopla anel interno à persistência
- Use case importando driver de DB ou framework — viola a Dependency Rule

### Princípios SOLID no M0

| Princípio | Definição (aula) | Onde se aplica no M0 |
|---|---|---|
| **SRP** | Uma unidade de código tem uma responsabilidade e uma razão para mudar | T9 — Controller extrai handler inline para classe com responsabilidade única. T10 — Presenter isola formatação de resposta do Controller. |
| **OCP** | Unidades abertas para extensão, fechadas para modificação | T6 — adicionar novo repositório (ex.: `PostgresCustomerRepository`) não exige alterar o use case. T11 — trocar implementação concreta altera apenas o Composition Root. |
| **LSP** | Uma classe deve ser substituível por outra do mesmo tipo base sem quebrar o software | T3 + T6 — `MongoCustomerRepository` implementa `ICustomerRepository`; qualquer implementação conforme pode ser substituída sem que o use case perceba. |
| **ISP** | Interfaces devem ser enxutas e focadas em uma única necessidade | T3 — cada domínio tem sua própria interface (`ICustomerRepository`, `IVehicleRepository`, `INotificationService`). Nenhum repositório expõe métodos que não usa. |
| **DIP** | Módulo de alto nível não depende de módulo de baixo nível — ambos dependem de abstrações | T4 — use cases dependem de Output Ports (interfaces), nunca de implementações concretas. T11 — Composition Root é o único ponto que conhece implementações concretas. |

### Tarefas

---

#### M0.T1 — Criar estrutura de diretórios alvo

Criar os diretórios da nova estrutura. Nenhuma lógica alterada — apenas `mkdir`.

```
src/entities/errors/
src/use-cases/ports/
src/use-cases/auth/
src/use-cases/customers/
src/use-cases/vehicles/
src/use-cases/services/
src/use-cases/items/
src/use-cases/service-orders/
src/use-cases/utils/
src/adapters/controllers/
src/adapters/presenters/
src/adapters/gateways/
src/adapters/services/
src/frameworks/http/middlewares/
src/frameworks/http/routes/
src/frameworks/http/swagger/
src/frameworks/database/models/
```

---

#### M0.T2 — Mover domain core para `src/entities/`

**Por que aqui (aula):** A camada Entities é o anel mais interno — contém os atores do negócio com dados + regras + restrições. Nenhuma dependência externa. Erros de domínio (`AppError`), a state machine e os validadores pertencem aqui porque são regras do negócio, não regras de aplicação.

Mover sem alterar lógica:
- `domain/entities/*` → `entities/`
- `domain/errors/AppError.ts` → `entities/errors/AppError.ts`
- `domain/serviceOrderStateMachine.ts` → `entities/serviceOrderStateMachine.ts`
- `domain/validators.ts` → `entities/validators.ts`

Atualizar todos os imports que referenciam `domain/entities/`, `domain/errors/`, `domain/serviceOrderStateMachine`, `domain/validators` em: use cases, gateways, routes e testes.

**Verificação:** nenhum arquivo em `entities/` deve importar de `use-cases/`, `adapters/` ou `frameworks/`.

---

#### M0.T3 — Mover Output Ports para `src/use-cases/ports/`

**Por que aqui (aula):** Ports são de propriedade da camada interna — são os use cases que definem o que precisam (Output Ports). As implementações concretas ficam em camada externa (Gateways). Manter as interfaces em `domain/ports/` era uma escolha do Hexagonal; no Clean Architecture elas ficam junto da camada que as define.

**ISP aplicado:** cada domínio tem sua própria interface separada — `ICustomerRepository` não carrega métodos de veículos, `INotificationService` não mistura capacidades de repositório. Use cases dependem apenas das capacidades que realmente precisam.

Mover sem alterar lógica:
- `domain/ports/ICustomerRepository.ts` → `use-cases/ports/`
- `domain/ports/IVehicleRepository.ts` → `use-cases/ports/`
- `domain/ports/IServiceRepository.ts` → `use-cases/ports/`
- `domain/ports/IItemRepository.ts` → `use-cases/ports/`
- `domain/ports/IServiceOrderRepository.ts` → `use-cases/ports/`
- `domain/ports/IUserRepository.ts` → `use-cases/ports/`
- `domain/ports/INotificationService.ts` → `use-cases/ports/`

Atualizar todos os imports que referenciam `domain/ports/` em: use cases e gateways.

**Verificação:** os arquivos em `use-cases/ports/` só devem importar de `entities/`.

---

#### M0.T4 — Mover use cases para `src/use-cases/`

**Por que aqui (aula):** Use Cases são Application Business Rules — orquestram entidades para entregar um resultado de negócio. Cada use case implementa exatamente uma regra. Recebe dependências via injeção tipadas por interface (Output Port), nunca por implementação concreta.

**DIP aplicado:** o use case (módulo de alto nível) depende do Output Port (abstração), nunca da classe concreta `MongoXxxRepository` (módulo de baixo nível, próximo à infraestrutura). A inversão ocorre porque a interface é definida pela camada interna, não pela externa.

Mover sem alterar lógica:
- `application/use-cases/auth/*` → `use-cases/auth/`
- `application/use-cases/customers/*` → `use-cases/customers/`
- `application/use-cases/vehicles/*` → `use-cases/vehicles/`
- `application/use-cases/services/*` → `use-cases/services/`
- `application/use-cases/items/*` → `use-cases/items/`
- `application/use-cases/service-orders/*` → `use-cases/service-orders/`
- `application/utils/serviceOrderUtils.ts` → `use-cases/utils/serviceOrderUtils.ts`

Atualizar todos os imports que referenciam `application/use-cases/` e `application/utils/`.

**Verificação:** nenhum arquivo em `use-cases/` deve importar de `adapters/` ou `frameworks/`.

---

#### M0.T5 — Mover database layer para `src/frameworks/database/`

**Por que aqui (aula):** Connection, seed e Mongoose models são detalhes de infraestrutura — pertencem ao anel Frameworks & Drivers. Models Mongoose não devem vazar para camadas internas; os Gateways (Interface Adapters) os usam internamente e devolvem entidades para os use cases.

Mover sem alterar lógica:
- `infrastructure/persistence/connection.ts` → `frameworks/database/connection.ts`
- `infrastructure/persistence/seed.ts` → `frameworks/database/seed.ts`
- `infrastructure/persistence/models/*` → `frameworks/database/models/`

Atualizar imports em: `main.ts`, gateways.

**Verificação:** nenhum arquivo em `entities/` ou `use-cases/` deve importar de `frameworks/database/`.

---

#### M0.T6 — Mover repositórios para `src/adapters/gateways/`

**Por que aqui (aula):** Gateways são a implementação concreta dos Output Ports. Responsabilidade: falar com o sistema externo (MongoDB), converter o resultado em instâncias de entidade e devolver ao use case. Expõem ações como atividades de negócio (`findById`, `create`), não como operações de baixo nível do driver.

**LSP aplicado:** `MongoCustomerRepository` (e cada Mongo*Repository) implementa a interface do Output Port correspondente. O use case recebe qualquer implementação conforme sem alterar seu comportamento — pode-se trocar para `PostgresCustomerRepository` sem quebrar nenhum use case.

**OCP aplicado:** adicionar suporte a um novo banco de dados exige criar uma nova classe que implementa a interface existente — nenhum use case é modificado. O comportamento é estendido sem abertura do código interno.

Mover sem alterar lógica:
- `infrastructure/persistence/repositories/MongoCustomerRepository.ts` → `adapters/gateways/`
- `infrastructure/persistence/repositories/MongoVehicleRepository.ts` → `adapters/gateways/`
- `infrastructure/persistence/repositories/MongoServiceRepository.ts` → `adapters/gateways/`
- `infrastructure/persistence/repositories/MongoItemRepository.ts` → `adapters/gateways/`
- `infrastructure/persistence/repositories/MongoServiceOrderRepository.ts` → `adapters/gateways/`
- `infrastructure/persistence/repositories/MongoUserRepository.ts` → `adapters/gateways/`

Atualizar imports em: routes (temporariamente — serão removidos no T10).

**Verificação:** os Gateways importam de `frameworks/database/models/` e de `use-cases/ports/`. Nunca de use cases diretamente.

---

#### M0.T7 — Mover ConsoleNotificationService para `src/adapters/services/`

**Por que aqui (aula):** É uma implementação concreta de um Output Port (`INotificationService`). Pertence à camada Interface Adapters junto com os outros adaptadores de comunicação externa.

Mover sem alterar lógica:
- `infrastructure/notifications/ConsoleNotificationService.ts` → `adapters/services/ConsoleNotificationService.ts`

Atualizar imports em: routes (temporariamente — serão removidos no T10).

---

#### M0.T8 — Mover middlewares e swagger para `src/frameworks/http/`

**Por que aqui (aula):** Middlewares Express e configuração de Swagger são responsabilidade do anel Frameworks & Drivers — implementam regras de acesso e contratos de API, não regras de negócio.

Mover sem alterar lógica:
- `infrastructure/http/middlewares/authMiddleware.ts` → `frameworks/http/middlewares/`
- `infrastructure/http/middlewares/errorMiddleware.ts` → `frameworks/http/middlewares/`
- `infrastructure/http/middlewares/roleMiddleware.ts` → `frameworks/http/middlewares/`
- `infrastructure/swagger/setup.ts` → `frameworks/http/swagger/setup.ts`

Atualizar imports em: routes, `app.ts`.

---

#### M0.T9 — Extrair Controllers para `src/adapters/controllers/`

**Por que (aula):** O Controller é um mensageiro — coordena o fluxo da requisição, constrói o input do use case e delega para um Presenter formatar a resposta. Não sabe **como** o use case funciona, não formata a resposta diretamente e não tem noção de "sucesso" ou "erro" de negócio.

**SRP aplicado:** o Controller tem uma única responsabilidade — coordenar o fluxo HTTP (extrair dados do `req`, acionar use case, entregar ao Presenter). Não toma decisões de negócio nem formata resposta. Uma razão para mudar: mudança no contrato HTTP do domínio.

**Problema atual:** os route files misturam registro de rotas, instanciação de dependências e handlers inline. O Controller deve ser uma classe separada que recebe use cases via construtor.

Criar um Controller por domínio:
- `adapters/controllers/AuthController.ts`
- `adapters/controllers/CustomerController.ts`
- `adapters/controllers/VehicleController.ts`
- `adapters/controllers/ServiceController.ts`
- `adapters/controllers/ItemController.ts`
- `adapters/controllers/ServiceOrderController.ts`

Cada método do Controller:
1. Extrai dados do `req` (parse)
2. Chama o use case correspondente com o input correto
3. Passa o resultado para o Presenter (T10) e retorna `res`

Os route files passam a delegar para o controller:
```typescript
router.post('/', (req, res, next) => controller.create(req, res, next));
```

**Verificação:** Controllers importam de `use-cases/` e de `adapters/presenters/`. Nunca de `frameworks/`.

---

#### M0.T10 — Extrair Presenters para `src/adapters/presenters/`

**Por que (aula):** O Presenter tem responsabilidade única: formatar o output do use case para o cliente que fez a requisição (headers HTTP, status code, body shape). O Controller não formata resposta — delega para o Presenter. A separação existe porque o formatting tende a ser complexo e varia por cliente.

**SRP aplicado:** o Presenter tem uma única responsabilidade — converter o output do use case para o formato HTTP. Não toma decisão de negócio, não acessa repositórios. Uma razão para mudar: mudança no shape da resposta JSON ou no código HTTP do domínio.

**Problema atual:** a resposta é construída inline nos handlers (`res.json(...)`, `res.status(201).json(...)`). Isso mistura responsabilidade de Controller com responsabilidade de Presenter.

Criar Presenters simples por domínio ou por operação:
- `adapters/presenters/CustomerPresenter.ts` (ex.: `toHttpResponse(customer): { status, body }`)
- Repetir para: Vehicle, Service, Item, ServiceOrder, Auth

Os Controllers passam a chamar o Presenter antes de escrever a resposta:
```typescript
const output = await this.createCustomer.execute(input);
const { status, body } = CustomerPresenter.created(output);
res.status(status).json(body);
```

---

#### M0.T11 — Centralizar DI em `main.ts` (Composition Root) e mover routes

**Por que (aula):** A camada Frameworks & Drivers injeta dependências concretas nos Controllers. É o único lugar onde se sabe qual implementação concreta usar. Nenhum outro arquivo faz `new MongoXxxRepository()`.

**DIP + OCP aplicados:** o Composition Root é o único ponto que conhece implementações concretas. As camadas internas dependem apenas de abstrações (DIP). Trocar uma implementação (ex.: `ConsoleNotificationService` por `EmailNotificationService`) requer modificar apenas este arquivo — nenhuma camada interna é aberta (OCP).

**Problema atual:** cada route file faz `new MongoXxxRepository()` e `new XxxUseCase()` internamente — viola a Dependency Rule (Frameworks instanciando Gateways acoplados à lógica de roteamento).

Passos:
- Remover toda instanciação de `new Mongo*` e `new *UseCase` dos route files
- Route files passam a receber o controller instanciado via parâmetro de função:
  ```typescript
  export function customerRoutes(controller: CustomerController): Router { ... }
  ```
- `main.ts` se torna o Composition Root:
  ```
  gateways → use cases → controllers → routes → app
  ```
- Mover route files para `frameworks/http/routes/`
- Atualizar `app.ts` para importar de `frameworks/http/routes/`

**Verificação:** apenas `main.ts` contém `new Mongo*`, `new *UseCase` e `new *Controller`.

---

#### M0.T12 — Remover diretórios legados e validar com testes

Após todas as movimentações:
- Deletar `src/domain/`
- Deletar `src/application/`
- Deletar `src/infrastructure/`
- Atualizar todos os imports nos arquivos em `tests/` para apontar para os novos paths
- Rodar `npm test` e confirmar que todos os testes passam sem erros

**Nota (aula):** A estratégia de testes da Clean Architecture prevê que os use cases sejam testados com mocks dos Output Ports, sem depender de banco real. Os testes de integração atuais (mongodb-memory-server) continuam válidos para os Gateways, mas os testes de use case deveriam usar mocks puros. Esse ajuste pode ser feito como tarefa de qualidade posterior, sem bloquear a entrega do M0.

---

#### M0.T13 — Revisar qualidade de código (Clean Code)

**Requisito do PDF:** "Refatorar o código da fase 1 aplicando: Clean Code (nomes claros, simplicidade, coesão)."

Fazer após a migração estrutural (T1–T12 concluídos). O objetivo é garantir que o código resultante seja legível e coeso, não apenas bem estruturado.

**Checklist de revisão:**

| Critério | O que verificar |
|---|---|
| Nomes claros | Variáveis, funções, classes e arquivos nomeados pelo que fazem — sem abreviações obscuras, sem nomes genéricos (`data`, `temp`, `obj`, `helper`) |
| Funções pequenas | Cada função faz uma coisa — se tem mais de ~20 linhas ou mais de um nível de abstração, candidata a extração |
| Coesão | Um arquivo, uma responsabilidade. Módulos que acumulam funções não relacionadas devem ser divididos |
| Sem código morto | Remover funções não usadas, imports não referenciados, comentários que explicam o que o código já diz |
| Sem magic numbers | Constantes nomeadas em vez de valores literais espalhados (`const VERIFICATION_CODE_LENGTH = 4`) |
| Legibilidade de condicionais | `if (os.status === 'DIAGNOSIS')` é legível; extrair condições complexas para variáveis nomeadas |

**Escopo:** o foco é no código novo/migrado em `src/entities/`, `src/use-cases/` e `src/adapters/`. O código de `src/frameworks/` (Express, Mongoose) tende a ser mais verboso por natureza — revisar, mas sem excesso.

**Verificação:** o código passa em `npm run lint` sem warnings e `npm test` sem erros.

---

## M1 — API: Abertura de OS com serviços e peças + Refinamento no diagnóstico

**Contexto:** O modelo de negócio foi alterado. Anteriormente, serviços e peças eram definidos exclusivamente durante o diagnóstico (status `DIAGNOSIS`) — a OS era aberta apenas com `customerId` e `vehicleId`. No novo modelo:

1. **Abertura:** o cliente já informa quais serviços quer executar e quais peças deseja usar. A OS é criada com essa lista pré-montada e o estoque das peças é reservado imediatamente.
2. **Diagnóstico:** o mecânico recebe a lista pré-montada. Sua função agora é refinar — pode **adicionar** serviços e peças não previstas pelo cliente, e pode **remover** serviços ou peças que não fizerem sentido após avaliação. Cada remoção de peça libera o estoque reservado na abertura.

**Gap no código atual:**
- `CreateServiceOrderUseCase` só injeta `IServiceOrderRepository` — não conhece serviços nem itens, não valida existência nem reserva estoque
- `AddServiceToOSUseCase` e `AddItemToOSUseCase` existem e permanecem válidos para adição no diagnóstico (validam `status === 'DIAGNOSIS'`)
- `RemoveServiceFromOSUseCase` e `RemoveItemFromOSUseCase` **não existem** — não há como o mecânico remover da lista durante o diagnóstico

**Decisão de design (princípio de aula):**

- **Criação com lista inicial:** a regra de negócio "abrir a OS com todos os seus dados iniciais" é uma responsabilidade única. Estender `CreateServiceOrderUseCase` é correto — não se cria um use case separado para fragmentar uma responsabilidade que pertence ao mesmo processo de abertura. Não se reutiliza `AddServiceToOSUseCase` porque ele carrega a restrição de DIAGNOSIS que não se aplica à abertura.

- **Remoção no diagnóstico:** as aulas ensinam que cada use case implementa exatamente uma operação de negócio. `RemoveServiceFromOS` e `RemoveItemFromOS` são operações distintas com regras distintas — a remoção de item carrega a responsabilidade adicional de liberar estoque, o que a remoção de serviço não faz. Dois use cases separados; não se absorve a diferença com um `if`.

### Tarefas

---

#### M1.T1 — Estender o Input Port de `CreateServiceOrderUseCase`

**O que é (aula):** O Input Port define o contrato de entrada do use case — o que o agente externo deve fornecer. O cliente passa a informar serviços e peças na abertura; ambos são opcionais para manter compatibilidade retroativa.

Alterar a interface `CreateServiceOrderInput` em `use-cases/service-orders/CreateServiceOrderUseCase.ts`:

```typescript
interface CreateServiceOrderInput {
  customerId: string;
  vehicleId: string;
  services?: string[];                            // serviceIds informados pelo cliente
  items?: { itemId: string; quantity: number }[]; // peças informadas pelo cliente com quantidade
}
```

Nenhuma lógica alterada nesta tarefa — apenas o shape do input.

---

#### M1.T2 — Injetar Output Ports de serviços e itens no `CreateServiceOrderUseCase`

**O que é (aula):** Use cases recebem dependências externas via injeção de Output Ports — nunca importam implementações concretas. O use case define o que precisa; o Gateway que está na camada Interface Adapters implementa.

Adicionar `IServiceRepository` e `IItemRepository` ao construtor:

```typescript
constructor(
  private readonly osRepo: IServiceOrderRepository,
  private readonly serviceRepo: IServiceRepository,
  private readonly itemRepo: IItemRepository,
) {}
```

Nenhuma lógica de negócio alterada nesta tarefa — apenas a assinatura do construtor.

---

#### M1.T3 — Implementar validação de serviços na criação

**O que é (aula):** O use case valida os inputs e aplica as regras de negócio antes de persistir. Para serviços: a regra é que cada `serviceId` informado deve existir no catálogo.

Na `execute()`, antes do `osRepo.create()`:

```typescript
const resolvedServices: OSService[] = [];
for (const serviceId of input.services ?? []) {
  const service = await this.serviceRepo.findById(serviceId);
  if (!service) throw new NotFoundError(`Service ${serviceId}`);
  resolvedServices.push({ serviceId });
}
```

**Validação:** se qualquer `serviceId` não existir → `NotFoundError`. A OS não é criada.

---

#### M1.T4 — Implementar validação e reserva de estoque de itens na criação

**O que é (aula):** Use cases coordenam múltiplas entidades e gateways para entregar o resultado de negócio. A reserva de estoque na abertura é uma regra de negócio — o cliente comprometeu essas peças para a OS. O Gateway não toma essa decisão; o use case a declara e o Gateway executa.

Na `execute()`, antes do `osRepo.create()`:

```typescript
const resolvedItems: OSItem[] = [];
for (const { itemId, quantity } of input.items ?? []) {
  const item = await this.itemRepo.findById(itemId);
  if (!item) throw new NotFoundError(`Item ${itemId}`);
  if (getAvailableQuantity(item) < quantity) {
    throw new ValidationError(`Insufficient stock for item ${itemId}`);
  }
  await this.itemRepo.update(itemId, {
    reservedQuantity: item.reservedQuantity + quantity,
  });
  resolvedItems.push({ itemId, quantity });
}
```

**Validação:** se qualquer item não existir → `NotFoundError`. Se estoque insuficiente → `ValidationError`. Nenhuma reserva parcial — as reservas de itens confirmados anteriormente no mesmo loop devem ser revertidas em caso de falha. Implementar rollback manual: ao capturar erro, iterar `resolvedItems` decrementando `reservedQuantity` de cada item já reservado antes de relançar o erro.

**Nota:** o estoque reservado aqui será liberado pelo `RemoveItemFromOSUseCase` (T10) quando o mecânico decidir remover a peça durante o diagnóstico.

---

#### M1.T5 — Finalizar `execute()` com os dados resolvidos

Após T3 e T4, criar a OS com os arrays populados:

```typescript
return this.osRepo.create({
  customerId: input.customerId,
  vehicleId: input.vehicleId,
  status: 'RECEIVED',
  services: resolvedServices,
  items: resolvedItems,
});
```

O Output Port `IServiceOrderRepository.create()` já aceita `services` e `items` no payload — nenhuma mudança no Gateway necessária.

---

#### M1.T6 — Atualizar o Composition Root (`main.ts`)

`CreateServiceOrderUseCase` agora exige três dependências. Atualizar a instanciação em `main.ts`:

```typescript
const createServiceOrder = new CreateServiceOrderUseCase(
  osGateway,
  serviceGateway,
  itemGateway,
);
```

**Verificação:** nenhum route file ou controller instancia repositórios — tudo flui do Composition Root.

---

#### M1.T7 — Atualizar Controller e Swagger

No `ServiceOrderController.create()`, extrair `services` e `items` do `req.body`:

```typescript
const os = await this.createServiceOrder.execute({
  customerId: req.body.customerId,
  vehicleId: req.body.vehicleId,
  services: req.body.services,
  items: req.body.items,
});
```

Atualizar a anotação `@openapi` na route correspondente em `frameworks/http/routes/serviceOrderRoutes.ts` para refletir os novos campos opcionais no `requestBody`.

---

#### M1.T8 — Atualizar e adicionar testes de integração

**O que é (aula):** Os testes de integração validam o comportamento do sistema com dependências reais (DB). Os testes de use case com mocks validam a regra de negócio isolada.

Adicionar cenários em `tests/integration/serviceOrders.test.ts`:

**Abertura:**
- Criar OS sem `services` e `items` → `201`, arrays vazios (compatibilidade retroativa)
- Criar OS com `services: [serviceId]` válido → `201`, `body.services` contém o serviceId
- Criar OS com `items: [{ itemId, quantity: 2 }]` válido → `201`, `body.items` contém o item; `item.reservedQuantity` aumenta em 2
- Criar OS com `serviceId` inexistente → `404`
- Criar OS com `itemId` inexistente → `404`
- Criar OS com quantidade maior que estoque disponível → `400`
- Criar OS com dois itens válidos, o segundo com estoque insuficiente → `400`; `reservedQuantity` do primeiro item **não aumenta** (rollback confirmado)

**Refinamento no diagnóstico — remoção de serviço:**
- OS em DIAGNOSIS com serviço na lista → remover serviço → `200`, serviço ausente em `body.services`
- OS em status diferente de DIAGNOSIS → tentar remover serviço → `400`
- Tentar remover serviço que não está na OS → `404`

**Refinamento no diagnóstico — remoção de peça:**
- OS em DIAGNOSIS com peça na lista → remover peça → `200`, peça ausente em `body.items`; `item.reservedQuantity` diminui pela quantidade que estava reservada
- OS em status diferente de DIAGNOSIS → tentar remover peça → `400`
- Tentar remover peça que não está na OS → `404`

---

#### M1.T9 — Criar `RemoveServiceFromOSUseCase`

**O que é (aula):** O use case implementa exatamente uma operação de negócio: o mecânico decide, durante o diagnóstico, que um serviço pré-selecionado pelo cliente não é necessário e o remove da OS. Regra de negócio: só é possível remover serviços quando a OS está em `DIAGNOSIS`.

**SRP aplicado:** remoção de serviço e remoção de peça são use cases distintos porque carregam regras distintas. Absorver os dois em um único use case com um parâmetro `type: 'service' | 'item'` viola SRP — o use case passaria a mudar por duas razões diferentes.

Criar `use-cases/service-orders/RemoveServiceFromOSUseCase.ts`:

```typescript
interface RemoveServiceFromOSInput {
  osId: string;
  serviceId: string;
}

class RemoveServiceFromOSUseCase {
  constructor(private readonly osRepo: IServiceOrderRepository) {}

  async execute(input: RemoveServiceFromOSInput): Promise<ServiceOrder> {
    const os = await this.osRepo.findById(input.osId);
    if (!os) throw new NotFoundError(`ServiceOrder ${input.osId}`);
    if (os.status !== 'DIAGNOSIS') {
      throw new ValidationError('Services can only be removed during DIAGNOSIS');
    }
    const exists = os.services.some(s => s.serviceId === input.serviceId);
    if (!exists) throw new NotFoundError(`Service ${input.serviceId} not in OS`);

    const updatedServices = os.services.filter(s => s.serviceId !== input.serviceId);
    return this.osRepo.update(input.osId, { services: updatedServices });
  }
}
```

Atualizar `main.ts` para instanciar e injetar no `ServiceOrderController`.

Adicionar rota `DELETE /service-orders/:osId/services/:serviceId` em `frameworks/http/routes/serviceOrderRoutes.ts`.

**Verificação:** o use case só importa de `entities/` e `use-cases/ports/`. Nenhum import de Mongoose ou framework.

---

#### M1.T10 — Criar `RemoveItemFromOSUseCase`

**O que é (aula):** O mecânico remove uma peça da OS durante o diagnóstico. Esta operação carrega uma responsabilidade adicional ausente na remoção de serviço: liberar o estoque que foi reservado na abertura da OS. A regra de negócio de liberação de estoque pertence ao use case — o Gateway não decide quando liberar.

**DIP aplicado:** o use case declara que precisa de `IItemRepository` para executar a liberação de estoque. A implementação concreta (`MongoItemRepository`) fica na camada Interface Adapters, injetada pelo Composition Root.

Criar `use-cases/service-orders/RemoveItemFromOSUseCase.ts`:

```typescript
interface RemoveItemFromOSInput {
  osId: string;
  itemId: string;
}

class RemoveItemFromOSUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly itemRepo: IItemRepository,
  ) {}

  async execute(input: RemoveItemFromOSInput): Promise<ServiceOrder> {
    const os = await this.osRepo.findById(input.osId);
    if (!os) throw new NotFoundError(`ServiceOrder ${input.osId}`);
    if (os.status !== 'DIAGNOSIS') {
      throw new ValidationError('Items can only be removed during DIAGNOSIS');
    }

    const osItem = os.items.find(i => i.itemId === input.itemId);
    if (!osItem) throw new NotFoundError(`Item ${input.itemId} not in OS`);

    const item = await this.itemRepo.findById(input.itemId);
    if (item) {
      await this.itemRepo.update(input.itemId, {
        reservedQuantity: Math.max(0, item.reservedQuantity - osItem.quantity),
      });
    }

    const updatedItems = os.items.filter(i => i.itemId !== input.itemId);
    return this.osRepo.update(input.osId, { items: updatedItems });
  }
}
```

Atualizar `main.ts` para instanciar com `osGateway` e `itemGateway` e injetar no `ServiceOrderController`.

Adicionar rota `DELETE /service-orders/:osId/items/:itemId` em `frameworks/http/routes/serviceOrderRoutes.ts`.

**Verificação:** o use case só importa de `entities/` e `use-cases/ports/`. A liberação de estoque ocorre antes da atualização da OS — se a liberação falhar, a OS não é atualizada e o estado permanece consistente.

---

#### M1.T11 — Atualizar `docs/DAS.md`

Atualizar os seguintes pontos para refletir o fluxo atual sem citar a versão anterior:

**RF-13** — substituir a descrição pela versão atual:
> Criar OS associada a um cliente e um veículo, com lista opcional de serviços e peças informada pelo cliente na abertura; estoque das peças é reservado imediatamente.

**RF-15** — substituir a descrição pela versão atual:
> No diagnóstico, o mecânico refina a lista pré-montada pelo cliente: pode adicionar serviços ausentes e remover serviços que não se aplicarem após avaliação técnica.

**RF-16** — substituir a descrição pela versão atual:
> No diagnóstico, o mecânico refina a lista pré-montada pelo cliente: pode adicionar peças reservando estoque (`reservedQuantity++`) e remover peças liberando o estoque reservado na abertura (`reservedQuantity--`).

**Seção "Reserva de estoque"** (linhas `add-item-to-OS` / `remove-item-from-OS`) — substituir pelo fluxo atual:

```
- POST /service-orders com items[]  → incrementa reservedQuantity de cada peça informada
- add-item-to-OS (DIAGNOSIS)        → incrementa reservedQuantity
- remove-item-from-OS (DIAGNOSIS)   → decrementa reservedQuantity
- transição EXECUTION               → decrementa stockQuantity, zera reservedQuantity
- transição REJECTED                → decrementa reservedQuantity (libera reserva de todos os itens)
```

**Tabela de transições** — coluna "Efeito colateral" da linha `WAITING_APPROVAL → APPROVED`:
> Reservas de itens já realizadas na abertura da OS e/ou durante o diagnóstico.

**Fluxo de aprovação pelo cliente** — passo 5:
> Rejeição libera o `reservedQuantity` de todos os itens da OS; aprovação não altera estoque (reservas já foram feitas).

**Endpoints de OS** — adicionar as duas novas rotas onde os demais DELETE de OS estão documentados:
- `DELETE /service-orders/:id/services/:serviceId` — remove serviço da OS em diagnóstico (mechanic, admin)
- `DELETE /service-orders/:id/items/:itemId` — remove peça da OS em diagnóstico, libera estoque (mechanic, admin)

---

#### M1.T12 — Atualizar `README.md`

**Tabela de papéis** — coluna do `attendant` — substituir descrição de abertura de OS pela versão atual:
> Abre OS informando opcionalmente os serviços e peças solicitados pelo cliente.

**Tabela de papéis** — coluna do `mechanic`:
> Executa diagnóstico (start/finish); refina lista de serviços e itens (adiciona ou remove); inicia e finaliza serviços individuais; executa, finaliza e entrega a OS.

**Lista de endpoints** — atualizar a linha de `POST /service-orders` e adicionar as rotas DELETE:
```
- POST /service-orders             — cria OS com serviços e peças opcionais (attendant, admin)
- DELETE /service-orders/:id/services/:serviceId — remove serviço da OS em DIAGNOSIS (mechanic, admin)
- DELETE /service-orders/:id/items/:itemId       — remove peça da OS em DIAGNOSIS, libera estoque (mechanic, admin)
```

---

#### M1.T13 — Atualizar `docs/ddd/ubiquitous-language.md`

**"Diagnóstico"** — substituir a descrição pela versão atual:
> Etapa em que o mecânico analisa o veículo com base na lista de serviços e peças informada pelo cliente na abertura da OS. O mecânico refina essa lista — adicionando o que for necessário e removendo o que não se aplicar — e encerra o diagnóstico com o orçamento calculado para aprovação.

**"Ordem de Serviço (OS)"** — adicionar nota ao mapeamento de implementação, refletindo que serviços e peças fazem parte da OS desde a abertura:
> `ServiceOrder` — agregado principal; `services[]` e `items[]` são populados na abertura pelo atendente (com base no cliente) e refinados pelo mecânico durante o diagnóstico.

---

## M2 — API: Listagem de OS com ordenação e exclusão de status finais

**Contexto:** O `GET /service-orders` atual aplica apenas filtros simples (status, customerId, datas). Não tem ordenação por prioridade nem exclui OS finalizadas/entregues por padrão.

**Gap no código atual:**
- `ListServiceOrdersUseCase` (`use-cases/service-orders/ListServiceOrdersUseCase.ts`) é wrapper puro: `return this.repo.findAll(filter)` — zero lógica de negócio
- `MongoServiceOrderRepository.findAll()` ordena por padrão do MongoDB (inserção) e não exclui nenhum status
- `ListServiceOrdersFilter` não tem campo para exclusão de status

**Decisão de design (princípio de aula):**
Dois aspectos diferentes com lugares distintos na arquitetura:

- **Exclusão de FINISHED/DELIVERED**: regra de visibilidade da listagem ativa. O use case declara o que precisa via Output Port (`excludeStatuses`); o Gateway implementa via `$nin` no MongoDB — separação limpa entre intenção de negócio e detalhe de persistência.
- **Ordenação por prioridade de status**: regra de negócio (qual OS precisa mais atenção). As aulas ensinam que camadas internas trabalham com os dados em si — o use case ordena após receber do Gateway. O Gateway não deve conhecer prioridade de negócio.

### Tarefas

---

#### M2.T1 — Estender o Output Port `ListServiceOrdersFilter` com `excludeStatuses`

**O que é (aula):** Output Ports são de propriedade do use case — ele define o que precisa e o Gateway implementa. Adicionar `excludeStatuses` é o use case declarando uma necessidade de negócio sem saber como o Gateway vai resolvê-la.

Em `use-cases/ports/IServiceOrderRepository.ts`, adicionar o campo ao filtro:

```typescript
export interface ListServiceOrdersFilter {
  status?: OSStatus;
  customerId?: string;
  from?: Date;
  to?: Date;
  excludeStatuses?: OSStatus[]; // novo
}
```

Nenhuma lógica alterada nesta tarefa — apenas o shape do Output Port.

---

#### M2.T2 — Atualizar Gateway para aplicar `excludeStatuses` na query MongoDB

**O que é (aula):** O Gateway traduz as necessidades do use case para operações do repositório concreto. Ele esconde os detalhes de conexão, drivers e sintaxe de query. A camada interna não vê `$nin` — apenas declara que não quer certos status.

Em `adapters/gateways/MongoServiceOrderRepository.ts`, no método `findAll()`:

```typescript
if (filter?.excludeStatuses?.length) {
  query.status = { ...query.status, $nin: filter.excludeStatuses };
}
```

Garantir que `excludeStatuses` e `status` coexistam no mesmo campo sem se sobrescrever (merge do objeto `query.status`).

**Verificação:** o Gateway não toma decisão sobre quais status excluir — apenas executa o que o Output Port recebeu.

---

#### M2.T3 — Aplicar exclusão padrão de FINISHED e DELIVERED no `ListServiceOrdersUseCase`

**O que é (aula):** A regra "listagem ativa não mostra OS finalizadas ou entregues" é uma Application Business Rule — pertence ao use case, não ao Gateway nem ao Controller.

Em `use-cases/service-orders/ListServiceOrdersUseCase.ts`:

```typescript
async execute(filter?: ListServiceOrdersFilter): Promise<ServiceOrder[]> {
  const activeFilter: ListServiceOrdersFilter = {
    ...filter,
    excludeStatuses: filter?.status
      ? undefined                              // filtro explícito de status: sem exclusão automática
      : ['FINISHED', 'DELIVERED'],
  };
  const orders = await this.repo.findAll(activeFilter);
  return this.sortByPriority(orders);
}
```

Regra: quando o chamador passa `status` explícito (ex.: `?status=FINISHED`), a exclusão automática não se aplica — o chamador sabe o que quer. Sem filtro de status: apenas OS ativas.

---

#### M2.T4 — Implementar ordenação por prioridade de status no use case

**O que é (aula):** A prioridade de atenção das OS (qual trabalho vem primeiro) é uma regra de negócio. Camadas internas trabalham com os dados em si — o use case aplica o critério de negócio após receber os dados do Gateway.

Adicionar método privado em `ListServiceOrdersUseCase`:

```typescript
private readonly STATUS_PRIORITY: Partial<Record<OSStatus, number>> = {
  EXECUTION: 1,
  WAITING_APPROVAL: 2,
  DIAGNOSIS: 3,
  RECEIVED: 4,
};

private sortByPriority(orders: ServiceOrder[]): ServiceOrder[] {
  return [...orders].sort((a, b) => {
    const pa = this.STATUS_PRIORITY[a.status] ?? 99;
    const pb = this.STATUS_PRIORITY[b.status] ?? 99;
    if (pa !== pb) return pa - pb;
    return a.createdAt.getTime() - b.createdAt.getTime(); // mais antigas primeiro
  });
}
```

Status fora da prioridade definida (APPROVED, REJECTED) ficam ao final — comportamento seguro e explícito.

**Verificação:** nenhum import de Mongoose ou driver no use case. O use case só conhece `ServiceOrder[]` e regras de negócio.

---

#### M2.T5 — Atualizar Swagger do endpoint `GET /service-orders`

Em `frameworks/http/routes/serviceOrderRoutes.ts`, atualizar a anotação `@openapi` do `GET /`:

- Documentar que por padrão a listagem exclui `FINISHED` e `DELIVERED`
- Documentar a ordenação: `EXECUTION > WAITING_APPROVAL > DIAGNOSIS > RECEIVED`, mais antigas primeiro
- Documentar que passar `?status=FINISHED` retorna apenas OS finalizadas (sem exclusão automática)

---

#### M2.T6 — Adicionar testes de integração

**O que cobrir:**

- OS com status `FINISHED` e `DELIVERED` **não aparecem** na listagem padrão `GET /service-orders`
- OS com status `RECEIVED`, `DIAGNOSIS`, `WAITING_APPROVAL` e `EXECUTION` **aparecem** na listagem padrão
- Passando `?status=FINISHED` retorna as OS finalizadas (exclusão automática não se aplica)
- Com múltiplas OS em status diferentes, a ordem retornada segue a prioridade: `EXECUTION` antes de `WAITING_APPROVAL`, antes de `DIAGNOSIS`, antes de `RECEIVED`
- Com duas OS no mesmo status, a mais antiga vem primeiro (`createdAt ASC`)

---

#### M2.T7 — Atualizar `docs/DAS.md`

**RF-26** — substituir a descrição pela versão atual:
> Listar OSs ativas com filtros opcionais (`status`, `customerId`, datas). Por padrão, exclui OS com status `FINISHED` e `DELIVERED` e ordena por prioridade operacional: `EXECUTION` › `WAITING_APPROVAL` › `DIAGNOSIS` › `RECEIVED`, mais antigas primeiro dentro do mesmo status. Quando `status` explícito é informado na requisição, a exclusão automática não se aplica — o sistema retorna exatamente as OS do status solicitado.

---

#### M2.T8 — Atualizar `README.md`

**Lista de endpoints** — substituir a linha de `GET /service-orders` pela versão atual:
```
- GET /service-orders   — lista OS ativas (exclui FINISHED e DELIVERED por padrão, ordenadas por
                          prioridade operacional); aceita ?status para consulta de qualquer status
                          sem exclusão automática (attendant, mechanic, admin)
```

---

## M3 — Notificações de status e de orçamento da OS

**Contexto:** Existem dois tipos de notificação distintos para a OS:

1. **Notificação de status** — enviada em toda mudança de status, informa o cliente que a situação da OS mudou.
2. **Notificação de orçamento** — enviada especificamente na transição `DIAGNOSIS → WAITING_APPROVAL`, traz o valor calculado do orçamento e instrui o cliente a aprovar ou recusar.

Na transição `DIAGNOSIS → WAITING_APPROVAL` o cliente recebe **dois emails em sequência**: primeiro a notificação de status (a OS mudou), depois a notificação de orçamento (aqui está o valor). São intenções de comunicação distintas — mensagens distintas, regras de conteúdo distintas.

**Gap no código atual:**
- `INotificationService` tem apenas `notifyBudgetReady` — sem contrato para notificação de status
- A notificação não é disparada nas demais transições de status
- Não existe `NotifyStatusChangeUseCase` nem `NotifyBudgetUseCase`

**Decisão de design (princípio de aula):**

- **Dois use cases de notificação (aula — composição):** as aulas ensinam que um use case pode invocar outro para delegar uma sub-responsabilidade. `NotifyStatusChangeUseCase` e `NotifyBudgetUseCase` são sub-responsabilidades ortogonais às transições. O use case de transição delega ambas após persistir o status — não conhece a lógica de notificação.

- **Dois métodos no Output Port (ISP):** `notifyStatusChanged` e `notifyBudgetReady` são capacidades distintas no contrato do `INotificationService`. Mantê-los separados no port permite que uma implementação futura trate cada um diferentemente (ex.: canais distintos, templates distintos) sem alterar os use cases.

- **OCP:** adicionar um novo canal ou alterar o conteúdo das mensagens exige apenas alterar a implementação de `INotificationService` — nenhum use case de transição é tocado.

### Tarefas

---

#### M3.T1 — Estender Output Port `INotificationService` com `notifyStatusChanged`

Em `use-cases/ports/INotificationService.ts`, adicionar o segundo método ao contrato existente:

```typescript
export interface INotificationService {
  notifyStatusChanged(customer: Customer, os: ServiceOrder): Promise<void>;
  notifyBudgetReady(customer: Customer, os: ServiceOrder): Promise<void>;
}
```

**ISP aplicado:** dois métodos separados porque as mensagens têm conteúdo e propósito distintos. Nenhuma implementação é forçada a misturar as duas responsabilidades num único método com `if`.

---

#### M3.T2 — Atualizar `ConsoleNotificationService` com os dois métodos

Em `adapters/services/ConsoleNotificationService.ts`, implementar ambos:

```typescript
async notifyStatusChanged(customer: Customer, os: ServiceOrder): Promise<void> {
  console.log(
    `[Status] OS ${os.id} → ${os.status} | cliente: ${customer.name} (${customer.email})`
  );
}

async notifyBudgetReady(customer: Customer, os: ServiceOrder): Promise<void> {
  console.log(
    `[Budget] OS ${os.id} | orçamento: R$ ${os.budgetTotal?.toFixed(2)} | cliente: ${customer.name} (${customer.email})`
  );
}
```

---

#### M3.T3 — Criar `NotifyStatusChangeUseCase`

**O que é (aula):** use case dedicado à sub-responsabilidade de comunicar mudança de status. Invocado por todos os use cases de transição após persistir o novo status. Falha silenciosa — não reverte a transição.

Criar `use-cases/service-orders/NotifyStatusChangeUseCase.ts`:

```typescript
class NotifyStatusChangeUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly notifier: INotificationService,
  ) {}

  async execute({ osId }: { osId: string }): Promise<void> {
    try {
      const os = await this.osRepo.findById(osId);
      if (!os) return;
      const customer = await this.customerRepo.findById(os.customerId);
      if (!customer) return;
      await this.notifier.notifyStatusChanged(customer, os);
    } catch {
      // best-effort
    }
  }
}
```

---

#### M3.T4 — Criar `NotifyBudgetUseCase`

**O que é:** use case dedicado à sub-responsabilidade de comunicar o orçamento. Invocado apenas por `FinishDiagnosisUseCase` após `NotifyStatusChangeUseCase`. Falha silenciosa — não reverte a transição.

Criar `use-cases/service-orders/NotifyBudgetUseCase.ts`:

```typescript
class NotifyBudgetUseCase {
  constructor(
    private readonly osRepo: IServiceOrderRepository,
    private readonly customerRepo: ICustomerRepository,
    private readonly notifier: INotificationService,
  ) {}

  async execute({ osId }: { osId: string }): Promise<void> {
    try {
      const os = await this.osRepo.findById(osId);
      if (!os) return;
      const customer = await this.customerRepo.findById(os.customerId);
      if (!customer) return;
      await this.notifier.notifyBudgetReady(customer, os);
    } catch {
      // best-effort
    }
  }
}
```

---

#### M3.T5 — Injetar use cases de notificação nos use cases de transição

Cada use case de transição recebe `NotifyStatusChangeUseCase` e o invoca após persistir o novo status:

```typescript
await this.osRepo.update(osId, { status: newStatus });
await this.notifyStatusChange.execute({ osId });
```

`FinishDiagnosisUseCase` invoca os dois em sequência — primeiro status, depois orçamento:

```typescript
await this.osRepo.update(osId, { status: 'WAITING_APPROVAL', budgetTotal });
await this.notifyStatusChange.execute({ osId });
await this.notifyBudget.execute({ osId });
```

Use cases a atualizar:

| Use case | Transição | Notificações |
|---|---|---|
| `StartDiagnosisUseCase` | `RECEIVED → DIAGNOSIS` | status |
| `FinishDiagnosisUseCase` | `DIAGNOSIS → WAITING_APPROVAL` | status + budget |
| `ApproveBudgetUseCase` | `WAITING_APPROVAL → APPROVED` | status |
| `RejectBudgetUseCase` | `WAITING_APPROVAL → REJECTED` | status |
| `StartExecutionUseCase` | `APPROVED → EXECUTION` | status |
| `FinishExecutionUseCase` | `EXECUTION → FINISHED` | status |
| `DeliverOSUseCase` | `FINISHED → DELIVERED` | status |

---

#### M3.T6 — Atualizar Composition Root (`main.ts`)

```typescript
const notifier = new ConsoleNotificationService();
const notifyStatusChange = new NotifyStatusChangeUseCase(osGateway, customerGateway, notifier);
const notifyBudget       = new NotifyBudgetUseCase(osGateway, customerGateway, notifier);

const startDiagnosis  = new StartDiagnosisUseCase(osGateway, notifyStatusChange);
const finishDiagnosis = new FinishDiagnosisUseCase(osGateway, notifyStatusChange, notifyBudget);
const approveBudget   = new ApproveBudgetUseCase(osGateway, itemGateway, notifyStatusChange);
const rejectBudget    = new RejectBudgetUseCase(osGateway, itemGateway, notifyStatusChange);
// ... demais use cases de transição
```

**Verificação:** apenas `main.ts` instancia `ConsoleNotificationService`, `NotifyStatusChangeUseCase` e `NotifyBudgetUseCase`.

---

#### M3.T7 — Adicionar testes unitários

Em `tests/unit/NotifyStatusChangeUseCase.test.ts`:

```typescript
it('deve chamar notifyStatusChanged', async () => {
  const mockNotifier = { notifyStatusChanged: jest.fn().mockResolvedValue(undefined), notifyBudgetReady: jest.fn() };
  const useCase = new NotifyStatusChangeUseCase(mockOsRepo, mockCustomerRepo, mockNotifier);
  await useCase.execute({ osId: 'os-1' });
  expect(mockNotifier.notifyStatusChanged).toHaveBeenCalledTimes(1);
});

it('não deve propagar erro se o notificador falhar', async () => {
  const mockNotifier = { notifyStatusChanged: jest.fn().mockRejectedValue(new Error('down')), notifyBudgetReady: jest.fn() };
  const useCase = new NotifyStatusChangeUseCase(mockOsRepo, mockCustomerRepo, mockNotifier);
  await expect(useCase.execute({ osId: 'os-1' })).resolves.not.toThrow();
});
```

Em `tests/unit/FinishDiagnosisUseCase.test.ts` — verificar que ambas as notificações são disparadas:

```typescript
it('deve chamar notifyStatusChange e notifyBudget ao encerrar o diagnóstico', async () => {
  const mockNotifyStatusChange = { execute: jest.fn().mockResolvedValue(undefined) };
  const mockNotifyBudget       = { execute: jest.fn().mockResolvedValue(undefined) };
  const useCase = new FinishDiagnosisUseCase(mockOsRepo, mockNotifyStatusChange, mockNotifyBudget);

  await useCase.execute({ osId: 'os-1' });

  expect(mockNotifyStatusChange.execute).toHaveBeenCalledWith({ osId: 'os-1' });
  expect(mockNotifyBudget.execute).toHaveBeenCalledWith({ osId: 'os-1' });
});
```

---

## M4 — Manifests Kubernetes (`/k8s`)

**Contexto:** Diretório `/k8s` não existe no repositório. A aplicação está containerizada (Dockerfile multi-stage + Docker Compose), mas sem nenhum manifesto de orquestração.

**Princípio de organização:** um manifesto por recurso — nunca agrupar múltiplos kinds em um único YAML com `---`. Cada arquivo é independente, aplicável e revisável isoladamente.

**Gap no código atual:**
- Sem `/k8s` directory
- Sem endpoints de health check (`/health`, `/ready`) — obrigatórios para Probes
- Sem Namespace dedicado — recursos iriam para `default`
- Sem PodDisruptionBudget — nenhuma garantia de mínimo de réplicas durante manutenção de nó

**Referência de aula:**
- **Deployment**: gerencia ReplicaSets para workloads stateless com rolling update e rollback automático
- **StatefulSet**: para workloads stateful (MongoDB) — identidade de rede estável, storage persistente via `volumeClaimTemplates`, operações ordenadas; requer Headless Service
- **Service**: endpoint de rede estável para Pods; tipos — ClusterIP (interno), NodePort (via node), LoadBalancer (via cloud LB); Headless (`clusterIP: None`) para DNS estável por Pod
- **ConfigMap**: separa configuração do artefato de container; mesma imagem roda em múltiplos ambientes
- **Secret**: como ConfigMap, mas para dados sensíveis — armazenado com base64
- **HPA**: ajusta automaticamente réplicas com base em métricas de utilização (CPU, memória)
- **PodDisruptionBudget**: garante mínimo de réplicas disponíveis durante operações voluntárias (dreno de nó, atualizações)
- **Probes**: Liveness (reinicia Pod em falha), Readiness (remove Pod do Service até estar pronto), Startup (aguarda inicialização antes de ativar Liveness/Readiness)

### Tarefas

---

#### M4.T1 — Adicionar endpoints de health check na aplicação

**Por que (aula):** Probes fazem HTTP GET para endpoints da aplicação. Sem eles, as Probes não verificam o estado real do container — apenas se o processo está vivo.

Adicionar em `frameworks/http/routes/healthRoutes.ts`:

```typescript
import { Router } from 'express';

export function healthRoutes(): Router {
  const router = Router();
  router.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
  router.get('/ready', (_req, res) => res.status(200).json({ status: 'ready' }));
  return router;
}
```

Registrar em `app.ts` antes dos demais middlewares:
```typescript
app.use('/', healthRoutes());
```

**Verificação:** `GET /health` e `GET /ready` → `200` sem autenticação, sem rate limit.

---

#### M4.T2 — Criar estrutura de diretórios do `/k8s`

Um arquivo por recurso K8s. Nenhum YAML deve conter múltiplos recursos separados por `---`.

```
k8s/
  namespace.yaml              # Namespace dedicado — aplicado primeiro
  configmap.yaml              # variáveis não-sensíveis
  secret.yaml                 # variáveis sensíveis (JWT, SMTP, Mongo auth, admin)
  app-deployment.yaml         # Deployment da aplicação Node.js
  app-service.yaml            # Service da aplicação (NodePort/LoadBalancer)
  app-hpa.yaml                # HorizontalPodAutoscaler
  app-pdb.yaml                # PodDisruptionBudget
  mongo-statefulset.yaml      # StatefulSet do MongoDB (com volumeClaimTemplates)
  mongo-headless-service.yaml # Headless Service — requerido pelo StatefulSet para DNS por Pod
  mongo-service.yaml          # ClusterIP Service — usado pela app no MONGODB_URI
```

**Ordem de aplicação:** `namespace.yaml` → `configmap.yaml` + `secret.yaml` → demais recursos.

---

#### M4.T3 — Criar `namespace.yaml`

**Por que:** Namespace isola os recursos da aplicação do namespace `default` — evita colisão de nomes, permite políticas de acesso por namespace e facilita limpeza (`kubectl delete namespace oficina`).

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: oficina
  labels:
    app.kubernetes.io/part-of: fiap-tech-challenge
```

Todos os recursos seguintes devem declarar `namespace: oficina` em `metadata`.

---

#### M4.T4 — Criar `configmap.yaml`

**Por que (aula):** ConfigMap separa configuração do artefato — a mesma imagem roda em múltiplos ambientes com configs diferentes.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: oficina-config
  namespace: oficina
  labels:
    app.kubernetes.io/part-of: fiap-tech-challenge
data:
  PORT: "3000"
  MONGODB_URI: "mongodb://mongo-service.oficina.svc.cluster.local:27017/car-repair-shop"
  CORS_ORIGIN: "http://localhost:3000"
  ADMIN_EMAIL: "admin@master.com"
  SMTP_HOST: "smtp.example.com"
  SMTP_PORT: "587"
  SMTP_SECURE: "false"
  SMTP_FROM: "noreply@oficina.com"
```

`MONGODB_URI` usa o FQDN interno do cluster (`<service>.<namespace>.svc.cluster.local`) — mais explícito e seguro que shortname.

---

#### M4.T5 — Criar `secret.yaml`

**Por que (aula):** Secrets armazenam dados sensíveis separados dos ConfigMaps. O arquivo commitado contém apenas placeholders — valores reais são injetados no pipeline via `kubectl create secret` ou variáveis de ambiente da pipeline.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: oficina-secret
  namespace: oficina
  labels:
    app.kubernetes.io/part-of: fiap-tech-challenge
type: Opaque
stringData:
  JWT_SECRET: "change-me-in-production"
  ADMIN_PASSWORD: "change-me-in-production"
  SMTP_USER: "user@example.com"
  SMTP_PASS: "change-me-in-production"
  MONGO_ROOT_USERNAME: "admin"
  MONGO_ROOT_PASSWORD: "change-me-in-production"
```

`MONGO_ROOT_USERNAME` e `MONGO_ROOT_PASSWORD` são usados pelo StatefulSet do MongoDB para criar o usuário root na inicialização.

---

#### M4.T6 — Criar `app-deployment.yaml`

**Por que (aula):** Deployment gerencia réplicas stateless com rolling update automático. `resources.requests` são obrigatórios para o HPA calcular utilização relativa.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: oficina-app
  namespace: oficina
  labels:
    app.kubernetes.io/name: oficina-app
    app.kubernetes.io/part-of: fiap-tech-challenge
    app.kubernetes.io/component: api
spec:
  replicas: 2
  revisionHistoryLimit: 3
  selector:
    matchLabels:
      app.kubernetes.io/name: oficina-app
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  template:
    metadata:
      labels:
        app.kubernetes.io/name: oficina-app
        app.kubernetes.io/part-of: fiap-tech-challenge
        app.kubernetes.io/component: api
    spec:
      terminationGracePeriodSeconds: 30
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
      containers:
      - name: oficina-app
        image: <registry>/fiap-tech-challenge:<TAG>
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: oficina-config
        - secretRef:
            name: oficina-secret
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
        startupProbe:
          httpGet:
            path: /health
            port: 3000
          failureThreshold: 12
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 0
          periodSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 0
          periodSeconds: 5
          failureThreshold: 3
```

**Notas:**
- `<TAG>` deve ser substituído por uma tag de imagem específica (ex.: `v1.2.0` ou digest SHA) — nunca usar `latest` em produção
- `revisionHistoryLimit: 3` limita o histórico de revisões para evitar acúmulo de ReplicaSets
- `strategy.rollingUpdate` garante zero downtime: sobe 1 novo Pod antes de remover 1 antigo
- `startupProbe` dá até 60s (12×5s) para a app inicializar antes de ativar Liveness/Readiness
- `runAsUser: 1000` garante que o processo não roda como root dentro do container

---

#### M4.T7 — Criar `app-service.yaml`

**Por que (aula):** Service provê endpoint de rede estável — IPs de Pods mudam a cada restart; o Service IP é fixo.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: oficina-service
  namespace: oficina
  labels:
    app.kubernetes.io/name: oficina-app
    app.kubernetes.io/part-of: fiap-tech-challenge
spec:
  type: NodePort
  selector:
    app.kubernetes.io/name: oficina-app
  ports:
  - port: 80
    targetPort: 3000
    nodePort: 30080
```

Em ambiente cloud, substituir `type: NodePort` por `type: LoadBalancer` — o provedor atribui IP externo automaticamente.

---

#### M4.T8 — Criar `app-hpa.yaml`

**Por que (aula):** HPA ajusta réplicas automaticamente com base em métricas. `minReplicas: 2` garante HA — nunca cai para 1 réplica.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: oficina-hpa
  namespace: oficina
  labels:
    app.kubernetes.io/part-of: fiap-tech-challenge
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: oficina-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

#### M4.T9 — Criar `app-pdb.yaml`

**Por que:** PodDisruptionBudget garante que pelo menos 1 réplica permaneça disponível durante operações voluntárias (dreno de nó para manutenção, atualização de nó). Sem PDB, o K8s pode terminar todos os Pods de uma vez.

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: oficina-pdb
  namespace: oficina
  labels:
    app.kubernetes.io/part-of: fiap-tech-challenge
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: oficina-app
```

`minAvailable: 1` garante que durante qualquer disrupção voluntária pelo menos 1 réplica continua respondendo.

---

#### M4.T10 — Criar manifests do MongoDB

**Por que StatefulSet (aula):** MongoDB é um workload stateful — identidade de rede estável, storage persistente por Pod e operações ordenadas. StatefulSet usa `volumeClaimTemplates` para criar um PVC dedicado por Pod automaticamente — não é necessário um `mongo-pvc.yaml` separado.

**Por que dois Services (aula):** StatefulSet requer um Headless Service (`clusterIP: None`) para prover DNS estável por Pod (`mongo-0.mongo-headless.oficina.svc.cluster.local`). Um segundo Service ClusterIP é criado para que a aplicação use um hostname simples no `MONGODB_URI`.

**`mongo-headless-service.yaml`** — requerido pelo StatefulSet para DNS por Pod:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: mongo-headless
  namespace: oficina
  labels:
    app.kubernetes.io/name: mongo
    app.kubernetes.io/part-of: fiap-tech-challenge
spec:
  clusterIP: None
  selector:
    app.kubernetes.io/name: mongo
  ports:
  - port: 27017
    targetPort: 27017
```

**`mongo-service.yaml`** — ClusterIP para acesso da aplicação:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: mongo-service
  namespace: oficina
  labels:
    app.kubernetes.io/name: mongo
    app.kubernetes.io/part-of: fiap-tech-challenge
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: mongo
  ports:
  - port: 27017
    targetPort: 27017
```

**`mongo-statefulset.yaml`** — StatefulSet com `volumeClaimTemplates` e autenticação:
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongo
  namespace: oficina
  labels:
    app.kubernetes.io/name: mongo
    app.kubernetes.io/part-of: fiap-tech-challenge
    app.kubernetes.io/component: database
spec:
  serviceName: mongo-headless
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: mongo
  template:
    metadata:
      labels:
        app.kubernetes.io/name: mongo
        app.kubernetes.io/part-of: fiap-tech-challenge
        app.kubernetes.io/component: database
    spec:
      terminationGracePeriodSeconds: 60
      containers:
      - name: mongo
        image: mongo:7
        ports:
        - containerPort: 27017
        env:
        - name: MONGO_INITDB_ROOT_USERNAME
          valueFrom:
            secretKeyRef:
              name: oficina-secret
              key: MONGO_ROOT_USERNAME
        - name: MONGO_INITDB_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: oficina-secret
              key: MONGO_ROOT_PASSWORD
        resources:
          requests:
            cpu: "100m"
            memory: "256Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
        volumeMounts:
        - name: mongo-data
          mountPath: /data/db
  volumeClaimTemplates:
  - metadata:
      name: mongo-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 5Gi
```

**Notas:**
- `serviceName: mongo-headless` vincula o StatefulSet ao Headless Service — obrigatório para DNS estável
- `volumeClaimTemplates` cria o PVC `mongo-data-mongo-0` automaticamente — não é necessário manifest de PVC separado
- `MONGO_INITDB_ROOT_*` inicializa o MongoDB com autenticação — o `MONGODB_URI` no ConfigMap deve incluir as credenciais: `mongodb://admin:<password>@mongo-service.oficina.svc.cluster.local:27017/car-repair-shop?authSource=admin`
- `terminationGracePeriodSeconds: 60` dá tempo para o MongoDB finalizar escritas pendentes antes de ser terminado

---

#### M4.T11 — Revisar `Dockerfile` e `docker-compose.yml` para a fase 2

O PDF exige explicitamente "Dockerfile atualizado" e "docker-compose revisado" como entregáveis. A migração do M0 altera a estrutura de diretórios da aplicação — o ponto de entrada do container pode precisar de atualização.

**Dockerfile — pontos de revisão:**

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

# ATENÇÃO: verificar se o entrypoint bate com o output do tsc após M0
CMD ["node", "dist/main.js"]

EXPOSE 3000

# Health check nativo do Docker (complementa as Probes do K8s)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
```

**Verificações após M0:**
- Confirmar que `tsconfig.json` → `outDir` aponta para `dist/` e inclui `src/frameworks/`, `src/adapters/`, `src/use-cases/`, `src/entities/`
- Confirmar que `CMD ["node", "dist/main.js"]` corresponde ao caminho real do `main.ts` compilado
- Rodar `docker build` e `docker run -p 3000:3000 <imagem>` localmente antes de subir para o K8s

**docker-compose.yml — pontos de revisão:**

```yaml
version: '3.9'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - MONGODB_URI=mongodb://admin:secret@mongo:27017/car-repair-shop?authSource=admin
      - JWT_SECRET=dev-secret-change-in-prod
    depends_on:
      mongo:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=secret
      - MONGO_INITDB_DATABASE=car-repair-shop
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mongo-data:
```

**Por que alinhar o docker-compose com o K8s:**
- `MONGODB_URI` com credenciais embutidas (mesmo formato do Secret K8s) — sem variável separada de user/password para o compose
- `healthcheck` na aplicação garante que o `depends_on: condition: service_healthy` funcione — evita race condition na inicialização
- Mongo com autenticação no compose (mesmo que no K8s via Secret) — ambiente local fiel ao de produção

---

## M5 — Infraestrutura como Código Terraform (`/infra`)

**Contexto:** Diretório `/infra` não existe no repositório. Todo o ambiente roda **localmente** com Minikube — sem cloud provider, sem backend remoto. O Terraform neste milestone tem um papel específico: declarar a ordem correta de aplicação dos manifests do M4 e prover um ponto único de entrada (`terraform apply`) para subir ou destruir todo o ambiente local.

**O que o Terraform faz aqui:**
- Conecta ao Minikube via kubeconfig local
- Aplica os manifests de `/k8s/` na ordem de dependência correta (Namespace → ConfigMap/Secret → StatefulSet/Deployment → Services → HPA/PDB)
- Provê `terraform destroy` para limpar o ambiente inteiro com um único comando

**O que o Terraform não faz aqui:**
- Não provisiona o cluster Minikube (pré-requisito manual)
- Não gerencia state remoto (state local em `infra/terraform.tfstate`)
- Não cria recursos de cloud

**Referência de aula:**
- **Provider `kubectl`** (`gavinbunney/kubectl`): aplica arquivos YAML de manifests K8s diretamente, mantendo os YAMLs do M4 como fonte da verdade
- **Provider `kubernetes`** (`hashicorp/kubernetes`): alternativa que define recursos K8s em HCL — não usado aqui para evitar duplicar o que já está em `/k8s`
- **State local**: `terraform.tfstate` gerado em `/infra/` — suficiente para ambiente local single-developer; nunca commitar
- **Módulos**: organizam recursos relacionados em unidades reutilizáveis (`main.tf` + `variables.tf` + `outputs.tf`)

### Pré-requisitos (manuais — fora do Terraform)

```bash
minikube start --cpus=2 --memory=4096
```

Minikube deve estar rodando antes de `terraform apply`. O kubeconfig é gerado automaticamente em `~/.kube/config`.

### Tarefas

---

#### M5.T1 — Criar estrutura de arquivos do `/infra`

```
infra/
  main.tf          # providers e recursos kubectl_manifest para cada YAML do /k8s
  variables.tf     # kubeconfig_path, namespace
  outputs.tf       # URL de acesso à aplicação
  .gitignore       # *.tfstate, *.tfstate.backup, .terraform/
```

---

#### M5.T2 — Criar `.gitignore` para `/infra`

```gitignore
# state local — contém valores de recursos criados, potencialmente sensível
*.tfstate
*.tfstate.backup

# diretório de plugins baixados pelo terraform init
.terraform/
.terraform.lock.hcl
```

---

#### M5.T3 — Criar `variables.tf`

```hcl
variable "kubeconfig_path" {
  description = "Caminho para o kubeconfig do Minikube"
  type        = string
  default     = "~/.kube/config"
}

variable "kubeconfig_context" {
  description = "Contexto do kubeconfig a usar (ex.: minikube)"
  type        = string
  default     = "minikube"
}

variable "namespace" {
  description = "Namespace Kubernetes onde os recursos serão criados"
  type        = string
  default     = "oficina"
}
```

---

#### M5.T4 — Criar `main.tf`

**Por que (aula):** O provider `kubectl` aplica arquivos YAML existentes mantendo os manifests do M4 como fonte da verdade — o Terraform não redefine os recursos em HCL, apenas os orquestra.

```hcl
terraform {
  required_providers {
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = ">= 1.14.0"
    }
  }
}

provider "kubectl" {
  config_path    = var.kubeconfig_path
  config_context = var.kubeconfig_context
}

# 1. Namespace — deve existir antes de todos os outros recursos
resource "kubectl_manifest" "namespace" {
  yaml_body = file("${path.module}/../k8s/namespace.yaml")
}

# 2. Configuração — depende do Namespace
resource "kubectl_manifest" "configmap" {
  yaml_body  = file("${path.module}/../k8s/configmap.yaml")
  depends_on = [kubectl_manifest.namespace]
}

resource "kubectl_manifest" "secret" {
  yaml_body  = file("${path.module}/../k8s/secret.yaml")
  depends_on = [kubectl_manifest.namespace]
}

# 3. MongoDB — depende de ConfigMap e Secret
resource "kubectl_manifest" "mongo_headless_service" {
  yaml_body  = file("${path.module}/../k8s/mongo-headless-service.yaml")
  depends_on = [kubectl_manifest.namespace]
}

resource "kubectl_manifest" "mongo_service" {
  yaml_body  = file("${path.module}/../k8s/mongo-service.yaml")
  depends_on = [kubectl_manifest.namespace]
}

resource "kubectl_manifest" "mongo_statefulset" {
  yaml_body  = file("${path.module}/../k8s/mongo-statefulset.yaml")
  depends_on = [
    kubectl_manifest.secret,
    kubectl_manifest.mongo_headless_service,
  ]
}

# 4. Aplicação — depende do MongoDB estar declarado e do ConfigMap/Secret
resource "kubectl_manifest" "app_deployment" {
  yaml_body  = file("${path.module}/../k8s/app-deployment.yaml")
  depends_on = [
    kubectl_manifest.configmap,
    kubectl_manifest.secret,
    kubectl_manifest.mongo_statefulset,
  ]
}

resource "kubectl_manifest" "app_service" {
  yaml_body  = file("${path.module}/../k8s/app-service.yaml")
  depends_on = [kubectl_manifest.namespace]
}

resource "kubectl_manifest" "app_hpa" {
  yaml_body  = file("${path.module}/../k8s/app-hpa.yaml")
  depends_on = [kubectl_manifest.app_deployment]
}

resource "kubectl_manifest" "app_pdb" {
  yaml_body  = file("${path.module}/../k8s/app-pdb.yaml")
  depends_on = [kubectl_manifest.app_deployment]
}
```

**Verificação:** `terraform validate` deve passar sem erros. `terraform plan` deve listar todos os recursos sem diff de estado.

---

#### M5.T5 — Criar `outputs.tf`

```hcl
output "app_url" {
  description = "URL de acesso à aplicação via Minikube NodePort"
  value       = "Execute: minikube service oficina-service -n ${var.namespace} --url"
}

output "namespace" {
  description = "Namespace onde os recursos foram criados"
  value       = var.namespace
}
```

---

#### M5.T6 — Documentar comandos de uso

Adicionar seção `## Infraestrutura local` ao `README.md` principal com:

```bash
# Pré-requisito: Minikube rodando
minikube start --cpus=2 --memory=4096

# Inicializar Terraform (baixa o provider kubectl)
cd infra/
terraform init

# Visualizar o que será criado
terraform plan

# Aplicar todos os recursos no Minikube
terraform apply

# Acessar a aplicação
minikube service oficina-service -n oficina --url

# Destruir todo o ambiente
terraform destroy
```

---

## M6 — Pipeline CI/CD

**Contexto:** Nenhum arquivo de pipeline existe no repositório. O ambiente é local (Minikube), o que impede o uso de runners hospedados pelo GitHub para o deploy — eles não têm acesso ao cluster local.

**Confirmação do professor:** ambiente totalmente local (Minikube + self-hosted runner) é válido para a fase 2. A única exigência é que o CI/CD seja completo e execute de ponta a ponta — **o histórico do GitHub Actions será avaliado**. Todos os workflows devem constar no repositório com execuções bem-sucedidas registradas.

**Solução (aula — self-hosted runner):** um self-hosted runner é um agente que roda na máquina local e se conecta ao GitHub para receber e executar jobs. É o mecanismo correto para CD em ambientes on-premises: o GitHub orquestra, o runner local executa. O runner tem acesso ao Minikube, ao kubeconfig e ao Docker local — o que runners GitHub-hosted jamais teriam.

**Separação CI/CD:**

| Pipeline | Runner | Responsabilidade |
|---|---|---|
| CI (`.github/workflows/ci.yml`) | `ubuntu-latest` (GitHub-hosted) | build TypeScript, lint, testes — sem acesso ao ambiente local |
| CD (`.github/workflows/cd.yml`) | `self-hosted` (máquina local) | build da imagem no Docker do Minikube, deploy do banco de dados, deploy da aplicação |

O CD só dispara após CI passar com sucesso no branch `main`.

**Requisitos explícitos do CD (professor):**
- Build da imagem Docker
- Deploy do banco de dados (MongoDB StatefulSet via Terraform)
- Deploy no cluster Kubernetes (aplicação)
- Aplicação dos manifestos YAML no cluster

**Atenção operacional:** o self-hosted runner deve estar rodando como serviço (`svc.sh`) na máquina local no momento em que o CI completar. Se o runner estiver offline, o job de CD ficará em fila e falhará após 24h — sem histórico de sucesso no GitHub. Garantir que o runner está `Idle` antes de fazer push para `main`.

### Tarefas

---

#### M6.T1 — Configurar o self-hosted runner na máquina local

**O que é (aula):** o self-hosted runner é o agente local que o GitHub Actions usa para executar os jobs de CD. Sem ele, o deploy não tem como alcançar o Minikube.

Passos manuais (feitos uma única vez):

1. No repositório GitHub: `Settings → Actions → Runners → New self-hosted runner`
2. Selecionar OS (Linux/macOS/Windows) — GitHub gera o script de instalação com um token de registro único
3. Executar os comandos gerados na máquina local:

```bash
# baixar o runner
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64.tar.gz -L <url-gerada-pelo-github>
tar xzf actions-runner-linux-x64.tar.gz

# configurar com o token gerado pelo GitHub
./config.sh --url https://github.com/<org>/<repo> --token <TOKEN>

# iniciar o runner (mantém o processo em foreground)
./run.sh
```

Para rodar em background como serviço do sistema operacional:
```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

**Verificação:** no GitHub, `Settings → Actions → Runners` deve mostrar o runner com status `Idle`. O runner aparecerá como label `self-hosted` nos logs de workflow.

---

#### M6.T2 — Criar `.github/workflows/ci.yml` (CI — GitHub-hosted)

O CI valida o código a cada push e pull request. Roda no runner do GitHub — sem dependência de ambiente local.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Compile TypeScript
        run: npm run build

      - name: Lint
        run: npm run lint

  test:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
```

**Verificação:** todo push para `main` e todo PR aberto dispara este workflow. Falha em qualquer step bloqueia o merge e impede o CD de disparar.

---

#### M6.T3 — Criar `.github/workflows/cd.yml` (CD — self-hosted runner)

O CD roda apenas após o CI passar, apenas em push no `main`. Executa no self-hosted runner — que tem acesso ao Minikube local.

**Estratégia de imagem:** a imagem é construída diretamente no daemon Docker do Minikube (`eval $(minikube docker-env)`). Isso elimina a necessidade de um registry externo — a imagem já está disponível para os Pods sem `imagePullPolicy: Always` apontando para um registry remoto.

```yaml
name: CD

on:
  workflow_run:
    workflows: [CI]
    types: [completed]
    branches: [main]

jobs:
  deploy:
    runs-on: self-hosted
    if: ${{ github.event.workflow_run.conclusion == 'success' }}

    steps:
      - uses: actions/checkout@v3

      - name: Set image tag
        id: tag
        run: echo "sha=$(git rev-parse --short HEAD)" >> $GITHUB_OUTPUT

      - name: Build image into Minikube Docker daemon
        run: |
          eval $(minikube docker-env)
          docker build -t fiap-tech-challenge:${{ steps.tag.outputs.sha }} .

      - name: Update image tag in Deployment manifest
        run: |
          sed -i "s|image: .*fiap-tech-challenge:.*|image: fiap-tech-challenge:${{ steps.tag.outputs.sha }}|" k8s/app-deployment.yaml

      - name: Apply infrastructure with Terraform
        working-directory: infra/
        run: |
          terraform init -input=false
          terraform apply -auto-approve -input=false

      - name: Verify database deployment
        run: |
          kubectl rollout status statefulset/mongo -n oficina --timeout=180s

      - name: Verify application rollout
        run: |
          kubectl rollout status deployment/oficina-app -n oficina --timeout=120s
```

**Notas:**
- `workflow_run` + `conclusion == 'success'` garante que o CD só executa se o CI passou — CI é gate obrigatório do CD
- `eval $(minikube docker-env)` redireciona o Docker CLI para o daemon interno do Minikube — imagem construída já está disponível para os Pods sem registry externo
- `sed` atualiza o tag no manifest antes do `terraform apply` — cada deploy usa a imagem do commit exato
- `terraform apply` aplica todos os manifests em ordem (`depends_on`): namespace → configmap/secret → mongo StatefulSet → app Deployment → services → HPA/PDB
- `kubectl rollout status statefulset/mongo` verifica explicitamente o **deploy do banco de dados** — step separado do deploy da aplicação para deixar visível no histórico do GitHub
- `kubectl rollout status deployment/oficina-app` verifica a aplicação; falha de rollout falha o job inteiro

**Verificação:** após push para `main`, o workflow CI dispara primeiro; ao concluir com sucesso, o CD dispara no runner local. No GitHub (`Actions → CD → último run`) devem aparecer todos os steps concluídos com ✅, incluindo "Verify database deployment" e "Verify application rollout" — é esse histórico que será avaliado.

---

## M7 — Documentação completa para entrega da fase 2

**Contexto:** O PDF de entrega exige documentação de arquitetura, componentes, infra e deploy. O professor confirmou que o **C4 Model é válido** como formato de documentação arquitetural — não é exigido um DAS no formato tradicional.

**Clarificação do professor sobre documentação:**
- Parte descritiva: objetivos, tecnologias utilizadas
- Desenhos de arquitetura (pode ser mais de um): componentes da aplicação + infra + fluxo de deploy; o professor alertou que **o C4 Model normalmente não cobre fluxo de deploy** — pode ser um diagrama separado
- Como executar o projeto localmente (passo a passo completo)
- Documentação do Kubernetes: **o que cada manifesto faz** e como é feito o deploy
- Documentação do Terraform: **quais recursos são criados** e como aplicar
- Link para Swagger (`localhost:port`) OU collection do Postman **commitada no repositório** com link no README

**Lacuna:** O `/docs` atual contém somente `DAS.md` (fase 1) e `ddd/ubiquitous-language.md`. Faltam todos os documentos listados abaixo.

**Documentos a criar/atualizar:**

| Arquivo | Status | Tipo | Prioridade |
|---|---|---|---|
| `docs/c4.md` | criar | C4 Levels 1–3 (Context, Container, Component) | obrigatório |
| `docs/deploy-flow.md` | criar | Fluxo de deploy CI/CD + o que cada manifesto K8s faz + Terraform | obrigatório |
| `docs/components.md` | criar | Documentação de componentes por camada (Clean Architecture) | obrigatório |
| `docs/business-rules.md` | criar | Regras de negócio consolidadas | obrigatório |
| `README.md` | atualizar | Seções obrigatórias (descritivo, execução local, links) | obrigatório |
| `docs/postman/` | criar | Collection do Postman exportada | obrigatório |
| `docs/DAS.md` | atualizar | Atualizar RFs e arquitetura para fase 2 | secundário |

### Tarefas

---

#### M7.T1 — Criar `docs/c4.md` com os três níveis do modelo C4

O C4 model descreve a arquitetura em quatro níveis de detalhe progressivo. Para este projeto, os três primeiros níveis são suficientes.

**Level 1 — Context (quem usa o sistema e o que ele faz):**

```mermaid
flowchart TB
    cliente["Cliente Final\n(navegador / sem login)"]
    atendente["Atendente\n(interno)"]
    mecanico["Mecânico\n(interno)"]
    admin["Admin\n(interno)"]

    sistema["Car Repair Shop API\n──────────────────\nNode.js + TypeScript\nExpress + MongoDB\nRodando em Minikube"]

    cliente -->|"consulta status da OS\naprova/rejeita orçamento\n(código 4 dígitos)"| sistema
    atendente -->|"abre OS com serviços/peças pré-selecionados\ngerencia clientes e veículos"| sistema
    mecanico -->|"diagnóstico: refina serviços e peças\ncalcula orçamento\nexecuta OS"| sistema
    admin -->|"CRUD de catálogo\nGerencia usuários\nConsulta relatórios"| sistema
```

**Level 2 — Container (principais executáveis/processos):**

```mermaid
flowchart TB
    subgraph github["GitHub"]
        ci["CI Workflow\n(ubuntu-latest runner)\nbuild + lint + tests"]
        cd["CD Workflow\n(self-hosted runner)\ndocker build + terraform apply"]
    end

    subgraph local["Máquina local"]
        terraform["Terraform\n/infra\nkubectl provider"]

        subgraph minikube["Minikube Cluster — namespace: oficina"]
            api["API Container\nNode.js / Express\n:3000 → NodePort 30080"]
            mongo["MongoDB Container\nStatefulSet\n:27017 (headless)"]
            api -->|"mongoose\nMONGODB_URI via Secret"| mongo
        end

        terraform -->|"kubectl_manifest\ndepends_on order"| minikube
    end

    ci -->|"workflow_run: completed"| cd
    cd -->|"eval minikube docker-env\nterraform apply"| local
```

**Level 3 — Component (camadas da Clean Architecture dentro da API):**

```mermaid
flowchart TB
    subgraph frameworks["Frameworks & Drivers"]
        express["Express\n(routers, middlewares)"]
        mongoose["Mongoose\n(ODM)"]
        jwt["jsonwebtoken"]
    end

    subgraph adapters["Interface Adapters"]
        ctrl["Controllers\n(HTTP → use case input)"]
        repos["Repository Implementations\n(Mongoose → IRepository)"]
        notif["ConsoleNotificationService\n(INotificationService)"]
    end

    subgraph usecases["Use Cases (Application)"]
        os_uc["OS Use Cases\nCreateOS, Diagnose, Approve...\nRemoveService, RemoveItem"]
        notify_uc["Notification Use Cases\nNotifyStatusChange\nNotifyBudget"]
        catalog_uc["Catalog Use Cases\nCRUD services, items"]
    end

    subgraph entities["Entities (Domain)"]
        ent["ServiceOrder · Customer\nVehicle · Service · Item"]
    end

    express -->|"chama"| ctrl
    ctrl -->|"invoca"| os_uc
    ctrl -->|"invoca"| catalog_uc
    os_uc -->|"invoca (composição)"| notify_uc
    os_uc -->|"acessa via IRepository"| ent
    notify_uc -->|"via INotificationService"| notif
    repos -->|"implementa IRepository"| mongoose
    notif -->|"implementa INotificationService"| frameworks
```

**Notas de implementação:**
- Usar Mermaid (renderizado nativamente no GitHub) em vez de imagem
- Nível 4 (código) não é exigido — omitir
- Os níveis 1–3 cobrem **componentes da aplicação e infraestrutura**
- O **fluxo de deploy** não é um nível do C4 — vai em diagrama separado no `docs/deploy-flow.md` (M7.T5)

---

#### M7.T2 — Atualizar `docs/DAS.md` para a fase 2 *(secundário)*

**Prioridade:** o professor não citou DAS como requisito explícito. O C4 + `docs/deploy-flow.md` + README cobrem os entregáveis obrigatórios. Atualizar o DAS apenas se houver tempo após concluir os demais documentos.

O `DAS.md` atual documenta a fase 1 (MVP monolítico sem Clean Architecture, sem K8s).

**Seções a atualizar/adicionar:**

| Seção | O que muda |
|---|---|
| Cabeçalho | Versão `2.0`, fase 2, data |
| 1.1 Requisitos Funcionais | Adicionar RFs novos: criação de OS com serviços/peças pré-selecionados (RF-13 revisado), remoção de serviço da OS (RF-15 revisado), remoção de item da OS (RF-16 revisado), notificação de status (RF-18), notificação de orçamento (RF-29) |
| 2. Arquitetura | Substituir "monolítica Express + MongoDB" por "Clean Architecture (4 anéis) com inversão de dependências; SOLID aplicado" — referenciar `docs/components.md` |
| Nova seção: Infraestrutura | Descrever Minikube, namespace `oficina`, recursos K8s (Deployment, StatefulSet, Services, HPA, PDB, ConfigMap, Secret) — referenciar `docs/deploy-flow.md` |
| Nova seção: CI/CD | Descrever os dois workflows (ci.yml / cd.yml) e o self-hosted runner |
| Nova seção: Notificações | Descrever `INotificationService`, `NotifyStatusChangeUseCase`, `NotifyBudgetUseCase`, gatilho em `DIAGNOSIS → WAITING_APPROVAL` |

**Não remover:** RFs da fase 1 que continuam válidos (RF-01 a RF-12, RF-19 a RF-28).

---

#### M7.T3 — Criar `docs/business-rules.md`

Consolidar todas as regras de negócio em um único documento estruturado, derivado do DAS e dos use cases implementados.

**Estrutura do documento:**

```markdown
# Regras de Negócio — Car Repair Shop

## 1. Ciclo de vida da Ordem de Serviço

### 1.1 State machine

| Estado atual | Transição | Estado seguinte | Ator | Regra |
|---|---|---|---|---|
| — | Criação | RECEIVED | Atendente | cliente + veículo devem existir; serviços e peças pré-selecionados reservam estoque |
| RECEIVED | Iniciar diagnóstico | DIAGNOSIS | Mecânico | — |
| DIAGNOSIS | Encerrar diagnóstico | WAITING_APPROVAL | Mecânico | calcula budgetTotal; dispara dois emails ao cliente |
| WAITING_APPROVAL | Aprovar | APPROVED | Cliente | código de 4 dígitos derivado do CPF/CNPJ |
| WAITING_APPROVAL | Rejeitar | REJECTED | Cliente | libera estoque reservado (reservedQuantity) |
| APPROVED | Iniciar execução | EXECUTION | Mecânico | consome estoque: decrementa stockQuantity e reservedQuantity |
| EXECUTION | Finalizar | FINISHED | Mecânico | todos os serviços devem estar COMPLETED |
| FINISHED | Entregar | DELIVERED | Atendente | — |

### 1.2 Abertura da OS (RECEIVED)

- O atendente informa ao cliente os serviços e peças pretendidos antes da OS ser criada.
- Na criação, o sistema registra essa lista pré-selecionada e reserva o estoque (`reservedQuantity += quantidade`) para cada peça.
- Qualquer item com estoque insuficiente (`stockQuantity - reservedQuantity < quantidade`) bloqueia a criação — a OS não é criada e nenhum estoque é reservado (operação atômica).

### 1.3 Refinamento no diagnóstico (DIAGNOSIS)

- O mecânico recebe a lista pré-selecionada ao iniciar o diagnóstico.
- Pode **adicionar** serviços e peças (reserva estoque adicional).
- Pode **remover** serviços e peças (libera a reserva: `reservedQuantity -= quantidade`).
- Adições e remoções só são permitidas no estado `DIAGNOSIS`.

## 2. Estoque

- `stockQuantity`: quantidade física disponível no estoque.
- `reservedQuantity`: quantidade comprometida com OSs em andamento (RECEIVED → EXECUTION).
- Quantidade disponível efetiva = `stockQuantity - reservedQuantity`.
- Ao iniciar execução (`APPROVED → EXECUTION`): `stockQuantity -= quantidade` e `reservedQuantity -= quantidade`.
- Ao rejeitar ou cancelar: `reservedQuantity -= quantidade` (devolução da reserva).

## 3. Notificações (DIAGNOSIS → WAITING_APPROVAL)

Quando o mecânico encerra o diagnóstico, o sistema dispara **dois** emails ao cliente:

| Email | Use Case | Conteúdo |
|---|---|---|
| Notificação de status | `NotifyStatusChangeUseCase` | Informa que a OS mudou para `WAITING_APPROVAL` |
| Orçamento | `NotifyBudgetUseCase` | Apresenta o `budgetTotal` e os serviços/peças listados |

- Ambas as notificações são **best-effort**: falhas não bloqueiam a transição de estado.
- Interface: `INotificationService` com os métodos `notifyStatusChanged` e `notifyBudgetReady`.
- Implementação atual: `ConsoleNotificationService` (log em console — sem envio real).

## 4. Aprovação de orçamento

- O código de verificação é derivado dos 4 últimos dígitos do CPF (PF) ou CNPJ (PJ) do cliente.
- A consulta pública de status e a aprovação/rejeição não exigem autenticação JWT.
- Após rejeição, a OS vai a `REJECTED` e o estoque reservado é liberado imediatamente.

## 5. Cálculo do orçamento

`budgetTotal = Σ service.price (para cada serviço na OS) + Σ (item.price × quantity) (para cada peça na OS)`

O cálculo ocorre no encerramento do diagnóstico (`DIAGNOSIS → WAITING_APPROVAL`).
```

---

#### M7.T4 — Criar `docs/components.md`

Documentar cada camada da Clean Architecture e os componentes que a compõem.

**Estrutura do documento:**

```markdown
# Documentação de Componentes — Car Repair Shop API

## Visão geral (Clean Architecture)

[diagrama Mermaid Level 3 — referenciar docs/c4.md]

As dependências sempre apontam de fora para dentro:
Frameworks → Adapters → Use Cases → Entities

Nenhuma camada interna importa de uma camada externa.

## Camada 1 — Entities (Domain)

Contém as entidades de negócio e suas invariantes. Sem dependências externas.

| Entidade | Atributos principais | Invariantes |
|---|---|---|
| ServiceOrder | id, customerId, vehicleId, status, services[], items[], budgetTotal, verificationCode | status segue a state machine; budgetTotal calculado no encerramento do diagnóstico |
| Customer | id, name, document (CPF/CNPJ), email, phone, type (PF/PJ) | document único; type determina formato de validação |
| Vehicle | id, customerId, plate, model, year | plate única por sistema |
| Service | id, name, price, estimatedMinutes | price > 0 |
| Item | id, name, price, stockQuantity, reservedQuantity | reservedQuantity ≤ stockQuantity |

## Camada 2 — Use Cases (Application)

Orquestram as regras de negócio. Dependem somente de interfaces (ports).

### OS Use Cases

| Use Case | Input | Output | Regras aplicadas |
|---|---|---|---|
| CreateServiceOrderUseCase | customerId, vehicleId, services[], items[] | ServiceOrder | reserva de estoque; verificação de disponibilidade atômica |
| StartDiagnosisUseCase | osId | ServiceOrder | RECEIVED → DIAGNOSIS |
| AddServiceToOSUseCase | osId, serviceId | ServiceOrder | somente em DIAGNOSIS |
| RemoveServiceFromOSUseCase | osId, serviceId | ServiceOrder | somente em DIAGNOSIS |
| AddItemToOSUseCase | osId, itemId, quantity | ServiceOrder | reserva estoque; somente em DIAGNOSIS |
| RemoveItemFromOSUseCase | osId, itemId | ServiceOrder | libera reserva; somente em DIAGNOSIS |
| CloseDiagnosisUseCase | osId | ServiceOrder | calcula budgetTotal; invoca NotifyStatusChange e NotifyBudget |
| ApproveServiceOrderUseCase | osId, verificationCode | ServiceOrder | valida código; WAITING_APPROVAL → APPROVED |
| RejectServiceOrderUseCase | osId, verificationCode | ServiceOrder | libera estoque; WAITING_APPROVAL → REJECTED |
| StartExecutionUseCase | osId | ServiceOrder | consome estoque; APPROVED → EXECUTION |
| FinishServiceOrderUseCase | osId | ServiceOrder | todos serviços COMPLETED; EXECUTION → FINISHED |
| DeliverServiceOrderUseCase | osId | ServiceOrder | FINISHED → DELIVERED |

### Notification Use Cases

| Use Case | Input | Comportamento |
|---|---|---|
| NotifyStatusChangeUseCase | osId | busca OS e cliente; chama notifier.notifyStatusChanged; best-effort (try/catch) |
| NotifyBudgetUseCase | osId | busca OS e cliente; chama notifier.notifyBudgetReady; best-effort (try/catch) |

### Ports (interfaces)

| Interface | Implementação atual | Localização |
|---|---|---|
| IServiceOrderRepository | MongoServiceOrderRepository | src/infra/repositories/ |
| ICustomerRepository | MongoCustomerRepository | src/infra/repositories/ |
| IItemRepository | MongoItemRepository | src/infra/repositories/ |
| IServiceRepository | MongoServiceRepository | src/infra/repositories/ |
| INotificationService | ConsoleNotificationService | src/infra/notification/ |

## Camada 3 — Interface Adapters

### Controllers

Traduzem HTTP request → use case input e use case output → HTTP response.
Não contêm lógica de negócio.

| Controller | Rota base | Responsabilidade |
|---|---|---|
| AuthController | /auth | Login, retorno de JWT |
| CustomerController | /customers | CRUD de clientes |
| VehicleController | /vehicles | CRUD de veículos |
| ServiceController | /services | CRUD de serviços + listagem com avg time |
| ItemController | /items | CRUD de itens |
| ServiceOrderController | /service-orders | CRUD de OS, transições de estado, aprovação pública |

### Repository Implementations

Implementam as IRepository interfaces usando Mongoose.
Isolam o domínio do MongoDB — o domínio não conhece Mongoose.

## Camada 4 — Frameworks & Drivers

| Componente | Responsabilidade |
|---|---|
| Express | HTTP server, roteamento, middlewares (autenticação JWT, validação) |
| Mongoose | ODM para MongoDB — usado somente nas repository implementations |
| jsonwebtoken | Geração e validação de JWT |
| bcrypt | Hash de senhas |

## Composition Root (`src/main.ts`)

Único ponto de instanciação concreta. Conecta as camadas:

```typescript
const itemRepo = new MongoItemRepository();
const osRepo = new MongoServiceOrderRepository();
const notifier = new ConsoleNotificationService();
const notifyStatus = new NotifyStatusChangeUseCase(osRepo, customerRepo, notifier);
const notifyBudget = new NotifyBudgetUseCase(osRepo, customerRepo, notifier);
const closeDiagnosis = new CloseDiagnosisUseCase(osRepo, notifyStatus, notifyBudget);
```
```

---

#### M7.T5 — Criar `docs/deploy-flow.md`

Documentar o fluxo de CI/CD, o que cada manifesto K8s faz, o que o Terraform provisiona, e a infraestrutura local de forma visual e operacional. O professor citou explicitamente que a documentação do K8s deve explicar "como é feito o deploy, o que os manifestos fazem" e que a documentação do Terraform deve descrever "quais recursos estão sendo criados e como aplicar".

**Estrutura do documento:**

```markdown
# Fluxo de Deploy — Car Repair Shop

## Visão geral

```mermaid
flowchart LR
    dev["Desenvolvedor\npush → main"]

    subgraph github["GitHub Actions"]
        ci["CI Workflow\nubuntu-latest\nbuild + lint + tests"]
        cd["CD Workflow\nself-hosted runner\ndeploy local"]
    end

    subgraph local["Máquina local (WSL2)"]
        runner["Self-hosted Runner\n(actions-runner/run.sh)"]
        minikube["Minikube\nKubernetes local"]
        terraform["Terraform\n/infra"]
    end

    dev -->|"push"| ci
    ci -->|"workflow_run: success"| cd
    cd -->|"dispara job"| runner
    runner -->|"eval minikube docker-env\ndocker build"| minikube
    runner -->|"terraform apply"| terraform
    terraform -->|"kubectl_manifest"| minikube
```

## Pipeline de CI (`.github/workflows/ci.yml`)

Dispara a cada push em `main` e em pull requests.
Runner: `ubuntu-latest` (GitHub-hosted).

| Passo | Comando | Objetivo |
|---|---|---|
| Checkout | `actions/checkout@v3` | Clonar o repositório |
| Setup Node | `actions/setup-node@v3` (Node 20) | Ambiente de build |
| Instalar deps | `npm ci` | Instalação reprodutível |
| Lint | `npm run lint` | Verificar estilo de código |
| Build | `npm run build` | Compilar TypeScript |
| Testes | `npm test` | Executar suite de testes |

## Pipeline de CD (`.github/workflows/cd.yml`)

Dispara somente após CI concluir com sucesso no branch `main`.
Runner: `self-hosted` (máquina local com acesso ao Minikube).

| Passo | Comando | Objetivo |
|---|---|---|
| Checkout | `actions/checkout@v3` | Clonar o repositório |
| Apontar para Minikube Docker | `eval $(minikube docker-env)` | Build no daemon do Minikube (sem registry externo) |
| Build da imagem | `docker build -t fiap-tech-challenge:<sha> .` | Criar imagem local |
| Terraform apply | `terraform init && terraform apply -auto-approve` | Aplicar manifests K8s via Terraform |
| Verificar rollout | `kubectl rollout status deployment/oficina-app -n oficina` | Confirmar deploy bem-sucedido |

## Infraestrutura Kubernetes local

```mermaid
flowchart TB
    subgraph namespace["namespace: oficina"]
        subgraph app["Aplicação"]
            deploy["Deployment\nofficina-app\nrollingUpdate"]
            hpa["HPA\nautoscaling/v2\n1–5 réplicas"]
            pdb["PodDisruptionBudget\nminAvailable: 1"]
            svc_app["Service (NodePort)\n:3000 → 30080"]
            hpa -->|"escala"| deploy
            pdb -->|"protege"| deploy
            svc_app -->|"expõe"| deploy
        end

        subgraph db["Banco de dados"]
            sts["StatefulSet\nmongo\nvolumeClaimTemplates: mongo-data (5Gi)"]
            svc_headless["Service Headless\nmongo-headless\n:27017"]
            svc_mongo["Service ClusterIP\nmongo-service\n:27017"]
            svc_headless -->|"DNS estável"| sts
            svc_mongo -->|"acesso pela API"| sts
        end

        cm["ConfigMap\nMONGODB_URI, PORT"]
        secret["Secret\nMONGO_USER, MONGO_PASS, JWT_SECRET"]

        deploy -->|"lê"| cm
        deploy -->|"lê"| secret
        sts -->|"lê"| secret
    end
```

## Configuração do self-hosted runner (setup único)

```bash
# 1. No GitHub: Settings → Actions → Runners → New self-hosted runner
# 2. Executar os comandos gerados pelo GitHub na máquina local:
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64.tar.gz -L <url-gerada>
tar xzf actions-runner-linux-x64.tar.gz
./config.sh --url https://github.com/<org>/<repo> --token <TOKEN>

# 3. Iniciar como serviço:
sudo ./svc.sh install && sudo ./svc.sh start
```

Verificação: `Settings → Actions → Runners` deve exibir o runner com status `Idle`.

## Pré-requisitos do ambiente local

```bash
# Minikube deve estar rodando antes de terraform apply
minikube start --cpus=2 --memory=4096

# Verificar kubectl apontando para Minikube
kubectl config current-context  # deve retornar: minikube

# Verificar Terraform instalado
terraform --version
```

## Manifests Kubernetes — o que cada arquivo faz

| Arquivo | Kind | O que faz |
|---|---|---|
| `namespace.yaml` | Namespace | Cria o namespace `oficina` — isola todos os recursos da aplicação do namespace `default` |
| `configmap.yaml` | ConfigMap | Armazena variáveis de configuração não-sensíveis: `PORT`, `MONGODB_URI` (sem credenciais) |
| `secret.yaml` | Secret | Armazena dados sensíveis em base64: `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`, `JWT_SECRET` |
| `mongo-headless-service.yaml` | Service (Headless) | `clusterIP: None` — fornece DNS estável por Pod para o StatefulSet (`mongo-0.mongo-headless.oficina`) |
| `mongo-service.yaml` | Service (ClusterIP) | Ponto de entrada estável para a aplicação acessar o MongoDB na porta `27017` |
| `mongo-statefulset.yaml` | StatefulSet | Roda o MongoDB com identidade estável e volume persistente de 5Gi por Pod via `volumeClaimTemplates` |
| `app-deployment.yaml` | Deployment | Roda a aplicação Node.js com rolling update — substitui Pods gradualmente sem downtime |
| `app-service.yaml` | Service (NodePort) | Expõe a aplicação externamente via `NodePort 30080` → `http://<minikube-ip>:30080` |
| `app-hpa.yaml` | HorizontalPodAutoscaler | Escala o Deployment automaticamente entre 1 e 5 réplicas com base no consumo de CPU (`70%`) |
| `app-pdb.yaml` | PodDisruptionBudget | Garante que pelo menos 1 réplica continue disponível durante operações de manutenção do nó |

## Infraestrutura Terraform — o que é criado

O Terraform (`/infra`) usa o provider `gavinbunney/kubectl` para aplicar os manifests do `/k8s` na ordem correta de dependência. Não provisiona infraestrutura de cloud — gerencia apenas os recursos K8s no Minikube local.

| Recurso Terraform | Manifesto aplicado | Depende de |
|---|---|---|
| `kubectl_manifest.namespace` | `k8s/namespace.yaml` | — |
| `kubectl_manifest.configmap` | `k8s/configmap.yaml` | namespace |
| `kubectl_manifest.secret` | `k8s/secret.yaml` | namespace |
| `kubectl_manifest.mongo_headless_service` | `k8s/mongo-headless-service.yaml` | namespace |
| `kubectl_manifest.mongo_service` | `k8s/mongo-service.yaml` | namespace |
| `kubectl_manifest.mongo_statefulset` | `k8s/mongo-statefulset.yaml` | secret, mongo_headless_service |
| `kubectl_manifest.app_deployment` | `k8s/app-deployment.yaml` | configmap, secret, mongo_statefulset |
| `kubectl_manifest.app_service` | `k8s/app-service.yaml` | app_deployment |
| `kubectl_manifest.app_hpa` | `k8s/app-hpa.yaml` | app_deployment |
| `kubectl_manifest.app_pdb` | `k8s/app-pdb.yaml` | app_deployment |

**Como aplicar:**
```bash
cd infra/
terraform init      # baixa o provider gavinbunney/kubectl
terraform plan      # mostra o que será criado
terraform apply     # aplica todos os recursos na ordem acima
terraform destroy   # remove tudo (exceto PVCs do StatefulSet — deletar manualmente se necessário)
```
```

---

#### M7.T6 — Atualizar `README.md` com seções obrigatórias do PDF

O README atual documenta apenas a fase 1. O PDF exige as seguintes seções no README de entrega:

**Seções a adicionar/substituir:**

```markdown
## Fase 2 — Car Repair Shop API

Descrição dos objetivos desta fase: migração para Clean Architecture, containerização com Kubernetes,
infraestrutura como código com Terraform, pipeline CI/CD com GitHub Actions e self-hosted runner.

## Arquitetura

Diagrama de arquitetura completo: [docs/c4.md](docs/c4.md)

- **Componentes da aplicação:** 4 camadas da Clean Architecture — Entities, Use Cases, Interface Adapters, Frameworks & Drivers. Ver [docs/components.md](docs/components.md).
- **Infraestrutura provisionada:** Minikube com namespace `oficina`, Deployment + StatefulSet + HPA + PDB + Services + ConfigMap + Secret. Ver [docs/deploy-flow.md](docs/deploy-flow.md).
- **Fluxo de deploy:** CI em GitHub-hosted runner (build/lint/test) + CD em self-hosted runner (docker build + terraform apply). Ver [docs/deploy-flow.md](docs/deploy-flow.md).

## Execução local

```bash
npm install
cp .env.example .env   # ajustar MONGODB_URI e JWT_SECRET
npm run dev
```

## Deploy em Kubernetes (Minikube)

```bash
minikube start --cpus=2 --memory=4096
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/
# ou via Terraform:
cd infra && terraform init && terraform apply
```

Acesso: `http://$(minikube ip):30080`

## APIs

Collection Postman: [docs/postman/car-repair-shop.postman_collection.json](docs/postman/car-repair-shop.postman_collection.json)
Swagger UI: `http://localhost:3000/api-docs` (ao rodar localmente ou após `minikube ip`:30080/api-docs)

## Vídeo demonstrativo

[link YouTube/Vimeo] <!-- substituir pelo link real; máximo 15 minutos -->
```

**Conteúdo obrigatório do vídeo (PDF):**

O vídeo deve ter até 15 minutos e demonstrar obrigatoriamente:

| Demonstração | O que mostrar |
|---|---|
| Deploy da aplicação | `terraform apply` sendo executado, pods subindo (`kubectl get pods -n oficina`) |
| Execução do CI/CD | Workflow CI rodando no GitHub Actions (build + teste), depois workflow CD sendo disparado e executando no self-hosted runner |
| Consumo das APIs | Chamadas reais às APIs via Postman ou curl (abertura de OS, diagnóstico, aprovação, listagem com ordenação) |
| Escalabilidade automática | HPA em ação — simular carga e mostrar réplicas aumentando (`kubectl get hpa -n oficina -w`) ou demonstrar com múltiplas OS criadas |

**Roteiro sugerido (ordem, 15 min):**
1. Visão geral rápida da arquitetura (C4, 2 min)
2. Push de código → CI no GitHub (2 min)
3. CD disparando no self-hosted runner: docker build + terraform apply (3 min)
4. Pods rodando: `kubectl get all -n oficina` (1 min)
5. Consumo das APIs: fluxo completo de uma OS (4 min)
6. Escalabilidade: HPA + simulação de carga (3 min)

**Tarefa adicional — exportar collection do Postman:**

O professor confirmou que a collection pode ser commitada no repositório. Exportar do Postman e salvar em `docs/postman/car-repair-shop.postman_collection.json`. O README deve apontar para esse arquivo com caminho relativo.

**Checklist de revisão do README antes da entrega:**
- [ ] Link do repositório GitHub visível
- [ ] Diagrama de arquitetura (C4) referenciado
- [ ] Diagrama de deploy flow referenciado
- [ ] Instruções de execução local testadas
- [ ] Instruções de K8s + Terraform testadas (com link para `docs/deploy-flow.md`)
- [ ] Collection Postman exportada em `docs/postman/` e linkada no README
- [ ] Swagger UI acessível após seguir as instruções locais
- [ ] Link do vídeo preenchido e funcional (≤ 15 min)

---

#### M7.T7 — Preparar entrega no portal do aluno

O PDF exige uma entrega separada no portal com três elementos obrigatórios:

**1. Compartilhar repositório com `soat-architecture`**

```
GitHub → repositório → Settings → Collaborators → Add people
Usuário: soat-architecture
```

O repositório deve estar acessível para o usuário de avaliação **antes** da submissão.

**2. Preparar o PDF de entrega**

O PDF deve conter:
- Link do repositório GitHub
- Desenho da arquitetura com os recursos escolhidos (pode ser o C4 Level 2 — Container — de `docs/c4.md`, exportado como imagem ou link do arquivo)
- Link do vídeo demonstrativo (YouTube ou Vimeo, público ou não-listado, até 15 min)

**Checklist antes de submeter no portal:**
- [ ] Repositório compartilhado com `soat-architecture`
- [ ] README atualizado com todas as seções (M7.T6)
- [ ] Vídeo publicado no YouTube/Vimeo com link acessível
- [ ] PDF montado com: link do repo + imagem/link da arquitetura + link do vídeo
- [ ] PDF submetido no portal do aluno dentro do prazo
