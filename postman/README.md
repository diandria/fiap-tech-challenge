# Collection Postman — Car Repair Shop API

Collection Postman com o fluxo completo da API de ponta a ponta: autenticação, dados mestres, ciclo de vida da OS (diagnóstico → orçamento → aprovação → execução → entrega), rejeição de orçamento, estatísticas e cenários de erro (401/403/400/404).

## Arquivos

- `car-repair-shop.postman_collection.json` — collection v2.1.0 com todas as chamadas organizadas em pastas numeradas.
- `car-repair-shop.postman_environment.json` — environment para **local / Docker Compose** (`baseUrl = http://localhost:3000`).
- `car-repair-shop-k8s.postman_environment.json` — environment para **Kubernetes / Minikube** (`baseUrl = http://localhost:8080`). Veja a configuração abaixo.

## Environments

| Arquivo | Ambiente | `baseUrl` |
|------|--------|-----------|
| `car-repair-shop.postman_environment.json` | Local / Docker Compose | `http://localhost:3000` |
| `car-repair-shop-k8s.postman_environment.json` | Kubernetes / Minikube | `http://localhost:8080` |

Todas as demais variáveis (credenciais, IDs persistidos) são idênticas entre os environments — apenas o `baseUrl` muda.

## Pré-requisitos

### Local / Docker Compose

1. API rodando em `http://localhost:3000` via `docker compose up`.
2. MongoDB rodando conforme o `.env`.
3. Seed do admin executado. Credenciais padrão:
   - `adminEmail`: `admin@master.com`
   - `adminPassword`: `change-me-in-production`
   Atualize-as para corresponder ao `ADMIN_PASSWORD` do seu `.env`.

### Kubernetes / Minikube

O Service é do tipo `LoadBalancer` na porta `8080`. No WSL2 com o driver Docker do Minikube, execute `minikube tunnel` uma vez em um terminal separado para expor `localhost:8080`:

```bash
minikube tunnel
```

Mantenha esse terminal aberto. Em seguida:

1. Infraestrutura aplicada via Terraform (`cd infra/ && terraform apply`).
2. Service acessível em `http://localhost:8080`.
3. O seed do admin roda automaticamente na inicialização do container, usando `ADMIN_EMAIL` (ConfigMap) e `ADMIN_PASSWORD` (Secret).

## Importação

No Postman: **Import → Upload Files** e selecione a collection mais o arquivo de environment desejado. Depois escolha o environment correspondente no seletor do canto superior direito.

## Ordem de execução (fluxo)

Execute as pastas na ordem numerada. Cada request persiste no environment o que as seguintes precisam (token, IDs). Use o **Collection Runner** ou execute manualmente em sequência.

| # | Pasta | O que faz |
|---|--------|--------------|
| 00 | Setup | Login do admin, cadastro de atendente/mecânico (idempotente: aceita 201 ou 409), login de ambos os papéis |
| 01 | Catálogo (admin) | Cria um serviço (Troca de Óleo, R$ 120) e um item (Óleo 5W30, R$ 40, estoque 10) |
| 02 | Cliente e Veículo (atendente) | Cria um cliente com CPF (`96627075300`, 4 primeiros dígitos = código de aprovação `9662`) e um veículo `ABC-1234` (idempotente: 409 reutiliza o registro existente) |
| 03 | OS Caminho Feliz | Ciclo completo: cria OS → diagnóstico → adiciona serviço + item (qtd 2) → finaliza diagnóstico (`budgetTotal = 200`) → consulta pública de status → aprova com código `9662` → execução → entrega |
| 04 | Rejeição | Segunda OS rejeitada após o orçamento — verifica que o item volta ao estoque |
| 05 | Estatísticas e Listagens | `avg-execution`, tempo médio do catálogo de serviços (`/services/avg-time`), filtros por `status` e `customerId`, detalhe por ID |
| 06 | Cenários de Erro | 401 (senha errada, sem token), 403 (papel errado), 400 (CPF/placa inválidos, código errado, transição inválida), 404 |
| 07 | Remoção de Item/Serviço da OS (mecânico) | Cria uma terceira OS e demonstra `DELETE /service-orders/:id/services/:serviceId` e `DELETE /service-orders/:id/items/:itemId` (libera estoque) |
| 08 | Manutenção (PUT/DELETE de entidades) | Cria cliente/veículo/serviço/item temporários e exercita todos os PUT e DELETE de catálogo e de cliente/veículo |

## Variáveis persistidas (preenchidas automaticamente)

`adminToken`, `attendantToken`, `mechanicToken`, `attendantId`, `mechanicId`, `customerId`, `customerTaxId`, `customerCode`, `vehicleId`, `serviceId`, `itemId`, `osId`, `osRejectId`, `osRemovalId`, `tempCustomerId`, `tempVehicleId`, `tempServiceId`, `tempItemId`.

## Regras de negócio cobertas pelo fluxo

- Código de aprovação do cliente = 4 primeiros dígitos do CPF/CNPJ.
- Máquina de estados da OS: `RECEIVED → DIAGNOSIS → WAITING_APPROVAL → APPROVED → EXECUTION → FINISHED → DELIVERED` (com ramificação `REJECTED` a partir de `WAITING_APPROVAL`).
- Transições internas da OS via `PATCH /service-orders/:id` com `{ status }` (mecânico+admin).
- Aprovação/rejeição de orçamento pelo cliente via `PATCH /service-orders/:id/budget` com `{ status: "APPROVED" | "REJECTED", code }` (público, com rate limit).
- Transições por serviço via `PATCH /service-orders/:id/services/:serviceId` com `{ status: "IN_PROGRESS" | "COMPLETED" }`.
- Total do orçamento = serviços + (item.price × quantidade).
- Autorização por papel: atendente (clientes/veículos/abertura de OS), mecânico (diagnóstico/execução/transições), admin (catálogo).
- Na transição `DIAGNOSIS → WAITING_APPROVAL` o servidor dispara uma notificação ao cliente via `INotificationService`. No MVP o adapter é um mock com `console.log` — a resposta da API não muda; verifique o stdout do servidor.

## Execução via CLI (Newman)

Local:
```bash
npx newman run postman/car-repair-shop.postman_collection.json \
  -e postman/car-repair-shop.postman_environment.json
```

Kubernetes (com `minikube tunnel` ativo):
```bash
npx newman run postman/car-repair-shop.postman_collection.json \
  -e postman/car-repair-shop-k8s.postman_environment.json
```

> Alteração para demonstração