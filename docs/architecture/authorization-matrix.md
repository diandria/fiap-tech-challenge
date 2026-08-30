# Matriz de rotas, perfis e fluxos de autenticação

Responde a três perguntas: **quais rotas existem**, **quais são protegidas** e **quais perfis podem
acessar cada operação**.

A fonte é `src/frameworks/http/routes/`. Toda rota registrada em `src/app.ts` aparece aqui.

**Relacionado:** [ADR-008](adr/ADR-008-escopo-autenticacao-cliente.md) (escopo da autenticação de
cliente e o critério das rotas públicas) e [ADR-002](adr/ADR-002-function-emissora-de-token.md)
(quem emite o token de cliente).

## Os dois fluxos de autenticação

O sistema tem **dois emissores de token**, com públicos diferentes. Ambos produzem um JWT Bearer,
distinguidos pela claim `type`.

### Fluxo 1 — Funcionário da oficina

```
POST /auth/login  (e-mail + senha)
        │
        ▼
  a própria aplicação valida com bcrypt e assina
        │
        ▼
  JWT { type: "staff", userId, role }      role ∈ { admin, attendant, mechanic }
```

Usado por atendente, mecânico e admin. A autorização é **por perfil** (`requireRole`).

### Fluxo 2 — Cliente

```
POST /auth/cpf  (CPF)          ← API Gateway
        │
        ▼
  function emissora de token (ADR-002)
        │
        ├──► POST /auth/customers/lookup  (x-internal-token)  ← aplicação
        │         devolve { id, name, active }
        ▼
  JWT { type: "customer", sub, cpf, name }     sub = customerId
```

A function **não** valida CPF nem consulta banco por conta própria: as duas regras vivem na
aplicação, e ela as consome pelo endpoint interno. A autorização é **por titularidade**, verificada
dentro do caso de uso.

**`sub` sempre vem do token, nunca do corpo ou da query.** Se viesse do cliente, a validação de
titularidade seria decorativa: bastaria informar o ID de quem se quisesse consultar.

## Legenda

| Símbolo | Significado |
|---|---|
| — | Sem autenticação (ver o critério no fim) |
| **staff** | Exige `type: "staff"` |
| **cliente** | Exige `type: "customer"` (`requireCustomer`) |
| **interno** | Exige o header `x-internal-token` (serviço, não pessoa) |
| **titularidade** | Além do perfil, a OS precisa ser do requisitante |

## Autenticação

| Rota | Método | Fluxo | Perfis | Observação |
|---|---|---|---|---|
| `/auth/login` | POST | — | qualquer um | Emite token de funcionário. Rate limit: 10 / 15 min |
| `/auth/register` | POST | staff | `admin` | Cadastra funcionário |
| `/auth/customers/lookup` | POST | **interno** | a function | Não documentada no Swagger. Rate limit: 30 / min. Comparação do segredo em tempo constante |
| `/auth/cpf` | POST | — | qualquer um | **Servida pela function, não pela aplicação.** Emite token de cliente |

## Ordens de serviço

| Rota | Método | Fluxo | Perfis | Observação |
|---|---|---|---|---|
| `/service-orders/:id/status` | GET | **cliente** | dono da OS | **titularidade**. Era pública até a Fase 2 |
| `/service-orders/:id/budget` | PATCH | **cliente** | dono da OS | **titularidade**. Exige `code` (4 primeiros dígitos do CPF/CNPJ). Rate limit: 5 / h por IP+OS |
| `/service-orders` | POST | staff | `attendant`, `admin` | Ver a nota sobre a abertura de OS |
| `/service-orders` | GET | staff | qualquer perfil | Filtros por `status`, `customerId`, período |
| `/service-orders/:id` | GET | staff | qualquer perfil | Detalhe completo |
| `/service-orders/:id` | PATCH | staff | `mechanic`, `admin` | Transições internas de status |
| `/service-orders/:id/services` | POST | staff | `mechanic`, `admin` | |
| `/service-orders/:id/services/:serviceId` | PATCH | staff | `mechanic`, `admin` | Início/fim de um serviço |
| `/service-orders/:id/services/:serviceId` | DELETE | staff | `mechanic`, `admin` | |
| `/service-orders/:id/items` | POST | staff | `mechanic`, `admin` | Reserva estoque |
| `/service-orders/:id/items/:itemId` | DELETE | staff | `mechanic`, `admin` | Libera estoque |
| `/service-orders/stats/avg-execution` | GET | staff | `attendant`, `admin` | |

## Clientes

| Rota | Método | Fluxo | Perfis | Observação |
|---|---|---|---|---|
| `/customers` | GET | staff | `attendant`, `admin` | |
| `/customers` | POST | staff | `attendant`, `admin` | |
| `/customers/:id` | GET | staff | `attendant`, `admin` | |
| `/customers/tax/:taxId` | GET | staff | `attendant`, `admin` | Busca por CPF/CNPJ |
| `/customers/:id` | PUT | staff | `attendant`, `admin` | |
| `/customers/:id` | DELETE | staff | `attendant`, `admin` | Remoção lógica |

## Veículos

| Rota | Método | Fluxo | Perfis | Observação |
|---|---|---|---|---|
| `/vehicles` | GET | staff | `attendant`, `admin` | |
| `/vehicles` | POST | staff | `attendant`, `admin` | |
| `/vehicles/:id` | GET | staff | `attendant`, `admin` | |
| `/vehicles/:id` | PUT | staff | `attendant`, `admin` | |
| `/vehicles/:id` | DELETE | staff | `attendant`, `admin` | |

## Serviços (catálogo)

| Rota | Método | Fluxo | Perfis | Observação |
|---|---|---|---|---|
| `/services` | GET | staff | qualquer perfil | **Era pública até a Fase 3.** O catálogo carrega preços |
| `/services/:id` | GET | staff | qualquer perfil | |
| `/services/avg-time` | GET | staff | `admin`, `mechanic`, `attendant` | |
| `/services` | POST | staff | `admin` | |
| `/services/:id` | PUT | staff | `admin` | |
| `/services/:id` | DELETE | staff | `admin` | |

## Itens (estoque)

| Rota | Método | Fluxo | Perfis | Observação |
|---|---|---|---|---|
| `/items` | GET | staff | qualquer perfil | |
| `/items/:id` | GET | staff | qualquer perfil | |
| `/items` | POST | staff | `admin` | |
| `/items/:id` | PUT | staff | `admin` | |
| `/items/:id` | DELETE | staff | `admin` | |

## Operação

| Rota | Método | Fluxo | Perfis | Observação |
|---|---|---|---|---|
| `/health` | GET | — | kubelet | Vivacidade. **Não** consulta o banco |
| `/ready` | GET | — | kubelet | Prontidão. Consulta o banco, com limite de 2 s |
| `/metrics` | GET | — | Prometheus | Não exposta no API Gateway |
| `/docs` | GET | — | qualquer um | Swagger UI |

## Nota — por que a abertura de OS continua sendo do atendente

A coordenação orientou que a rota de registro de OS deve ser protegida e que *"o tipo de
autenticação dependerá de quem executa a operação"*.

**No nosso domínio quem abre a OS é o atendente.** A abertura reserva estoque e monta a lista de
serviços com o cliente presente na oficina — não é uma operação que o cliente execute sozinho. Por
isso `POST /service-orders` permanece exclusiva de `attendant` e `admin`.

Isso não contraria a orientação: ela condiciona o **tipo de autenticação** a quem executa, e é a
nossa regra de negócio que define **quem executa**. O raciocínio fica registrado para que a decisão
não pareça requisito não atendido.

## Critério das rotas que continuam públicas

Uma rota só permanece sem autenticação se cair em **uma destas quatro** categorias (ADR-008):

1. **Autenticação** — precisa ser alcançável por quem ainda não tem token
2. **Health check** — consumida pelo kubelet, que não carrega credencial
3. **Documentação** — descreve o contrato, não expõe dado
4. **Webhook** — chamada por terceiro que autentica por outro mecanismo. Nenhuma existe hoje

O critério existe para que **rotas futuras se classifiquem sozinhas**, em vez de a lista ser
renegociada a cada uma.

`GET /metrics` é exceção deliberada e não entra na lista: o Prometheus raspa de dentro do cluster,
sem credencial, e a rota não é exposta no API Gateway.

## Resumo das mudanças da Fase 3

| Rota | Fase 2 | Fase 3 |
|---|---|---|
| `GET /service-orders/:id/status` | pública | cliente + titularidade |
| `PATCH /service-orders/:id/budget` | pública + código | cliente + titularidade + código |
| `GET /services` | pública | staff |
| `POST /auth/customers/lookup` | não existia | interno |
| `POST /auth/cpf` | não existia | pública, servida pela function |

Nenhuma rota de negócio permanece pública.
