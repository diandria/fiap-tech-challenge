# Collection Postman — Car Repair Shop API

Collection Postman com o fluxo da oficina de ponta a ponta pelos três serviços da Fase 4: o OS Service abre
e entrega a ordem, o Execution Service recebe o diagnóstico e o reparo, e o Billing Service gera o
orçamento e cobra. Entre eles, quem move a ordem é a saga. A coleção também cobre os cadastros, a
rejeição de orçamento, as listagens, os cenários de erro (401/403/400/404) e as sondas de saúde.

## Arquivos

- `car-repair-shop.postman_collection.json`: collection v2.1.0, com as chamadas em pastas numeradas.
- `car-repair-shop.postman_environment.json`: environment **local**, apontando para o compose de ponta a
  ponta em `e2e/`.
- `car-repair-shop-k8s.postman_environment.json`: environment da **AWS**, pelo API Gateway.

## Environments

| Variável | Local | AWS |
|---|---|---|
| `baseUrl` | `http://localhost:3000` (OS) | URL do API Gateway |
| `billingBaseUrl` | `http://localhost:3001` (Billing) | a mesma URL do API Gateway |
| `executionBaseUrl` | `http://localhost:3002` (Execution) | a mesma URL do API Gateway |
| `authBaseUrl` | vazio (não há função local) | a mesma URL do API Gateway |

Na AWS, as quatro variáveis recebem o mesmo endereço, porque o gateway leva cada caminho ao serviço dono
(`/executions` ao Execution, `/service-orders/{id}/budget` e `/payments` ao Billing, o resto ao OS).
Localmente, cada serviço tem a sua porta. As demais variáveis (credenciais e ids) são iguais nos dois
environments.

## Pré-requisitos

### Local

Os três serviços no compose de ponta a ponta, com os três repositórios lado a lado em `~/dev`:

```bash
cd ~/dev/fiap-tech-challenge
docker compose -f e2e/docker-compose.yml up --build -d --wait
```

O compose já usa as credenciais do environment local: admin `admin@master.com` com
`change-me-in-production` e `JWT_SECRET` igual ao `jwtSecret`. O Billing roda com o pagamento simulado.

### AWS (EKS + API Gateway)

A aplicação não é alcançável diretamente: os NLBs são internos e o único caminho de entrada é o API
Gateway (ADR-001). Descubra a URL e preencha `baseUrl`, `billingBaseUrl`, `executionBaseUrl` e
`authBaseUrl`:

```bash
cd ~/dev/fiap-tech-challenge-infra-k8s && terraform output api_gateway_url
```

`adminPassword` precisa ser o valor do parâmetro `/car-repair-shop/app/admin-password` no SSM.

## Importação

No Postman: **Import → Upload Files** e selecione a collection mais o arquivo de environment desejado.
Depois escolha o environment no seletor do canto superior direito.

## Ordem de execução

Rode as pastas na ordem numerada, no **Collection Runner**. Cada request guarda no environment o que as
seguintes precisam (tokens, ids).

| # | Pasta | O que faz |
|---|---|---|
| 00 | Setup | Login do admin, cadastro de atendente e mecânico (aceita 201 ou 409), login dos dois papéis |
| 01 | Catalog (admin) | Um serviço (Troca de Óleo, R$ 120) e uma peça (Óleo 5W30, R$ 40, estoque 10) |
| 02 | Customer and Vehicle (attendant) | Cliente com CPF `96627075300` (código de aprovação `9662`) e veículo `ABC-1234` |
| 03 | Fluxo da saga (até o pagamento) | O atendente abre a OS; o mecânico inicia o diagnóstico no Execution; a OS vai a `DIAGNOSIS`; o mecânico inclui serviço e peça e conclui o diagnóstico; o Billing gera o orçamento; o cliente consulta o status e aprova no Billing; o Billing cria a cobrança e o `checkoutUrl` aparece no console |
| 04 | Pagamento simulado (só local) | Aprova o pagamento no provedor simulado do Billing. Na AWS, este passo é o pagamento no navegador |
| 05 | Fluxo da saga (depois do pagamento) | A OS vai a `PAID`; o mecânico inicia o reparo, marca o serviço e conclui; a OS vai a `FINISHED`; o mecânico registra a entrega; o histórico confirma todas as etapas; a média por serviço vem do Execution |
| 06 | Orçamento rejeitado | Segunda OS até o orçamento, rejeitado pelo cliente no Billing; a saga leva a OS a `REJECTED` e devolve a peça ao estoque |
| 07 | Stats and Listings | Tempo médio do catálogo, filtros por `status` e `customerId`, detalhe por id |
| 08 | Error Scenarios | 401, 403, 400 (CPF e placa inválidos, código errado, entrega de OS não finalizada) e 404 |
| 09 | OS Item/Service Removal | Terceira OS, levada a `DIAGNOSIS` pelo Execution, para mostrar a remoção de serviço e de peça (que libera o estoque) |
| 10 | Maintenance | PUT e DELETE de cliente, veículo, serviço e peça temporários |
| 11 | Cliente (CPF) | Autenticação por CPF e titularidade: 401 sem token, 403 com token de funcionário ou de outro cliente |
| 12 | Health e Observabilidade | `/health`, `/ready` e `/metrics` do OS |

### Como a coleção espera a saga

A saga é assíncrona: depois de "concluir o diagnóstico", a OS só muda quando a resposta do Execution
chega ao OS pela fila. Os passos `Aguardar ...` perguntam de novo, a cada segundo, até o estado chegar ou
até 30 tentativas, e só então registram o teste. A nova tentativa usa
`pm.execution.setNextRequest(pm.info.requestId)`, que só funciona no Collection Runner e no newman. Enviado
à mão, o passo mostra o estado do momento.

### Pagamento na AWS

Na AWS, o Billing usa o Mercado Pago, e o Runner não consegue pagar sozinho:

1. Rode as pastas 00 a 03. A última requisição da 03 imprime o `checkoutUrl` no console e o guarda no
   environment.
2. Abra o link no navegador, entre com a conta de teste de comprador e pague com um cartão de teste do
   Mercado Pago, com o titular `APRO`. O passo a passo das contas de teste está no README do Billing.
3. Pule a pasta 04 e rode a 05.

## Variáveis guardadas pelos scripts

`adminToken`, `attendantToken`, `mechanicToken`, `customerToken`, `otherCustomerToken`, `attendantId`,
`mechanicId`, `customerId`, `customerTaxId`, `customerCode`, `vehicleId`, `serviceId`, `itemId`, `osId`,
`osRejectId`, `osRemovalId`, `checkoutUrl`, `tempCustomerId`, `tempVehicleId`, `tempServiceId`,
`tempItemId`.

## Autenticação de cliente

Há **dois fluxos de autenticação**, com emissores diferentes:

| Fluxo | Emissor | Rota | Token |
|---|---|---|---|
| Funcionário | o OS Service | `POST /auth/login` | `adminToken`, `attendantToken`, `mechanicToken` |
| Cliente | a função, pelo API Gateway | `POST /auth/cpf` | `customerToken` |

Os três serviços validam os dois tokens com o mesmo segredo. As rotas de cliente exigem token de cliente,
e o cliente só enxerga e decide sobre a própria OS.

### Como o `customerToken` é obtido

**Contra o ambiente implantado:** com `authBaseUrl` preenchido, a pasta 11 chama `/auth/cpf`, servida pela
função, e grava o token real.

**Localmente não existe função.** O script de pré-requisição da coleção emite um token com o **mesmo
formato e o mesmo segredo** (`jwtSecret`) quando `customerToken` está vazio. É uma conveniência de
desenvolvimento, não parte do produto. Contra o gateway, o token real sobrescreve o emitido localmente.
Por isso a chamada a `/auth/cpf` da pasta 11 dá erro de URL quando roda localmente com `authBaseUrl`
vazio, e o resto da coleção segue.

> `jwtSecret` precisa bater com o `JWT_SECRET` dos serviços. No compose de ponta a ponta é
> `dev-secret-change-in-prod`. Se divergir, o sintoma é um 401 sem mensagem útil.

## Regras de negócio cobertas pelo fluxo

- Estados da OS pela saga: `RECEIVED → DIAGNOSIS → WAITING_APPROVAL → APPROVED → PAID → EXECUTION →
  FINISHED → DELIVERED`, com `REJECTED` (orçamento recusado) e `CANCELLED` (pagamento recusado ou etapa
  que esgotou as tentativas).
- A única transição manual é a entrega: `PATCH /service-orders/:id` com `{ "status": "DELIVERED" }`
  (mecânico ou admin). As demais vêm das respostas do Billing e do Execution.
- O diagnóstico e o reparo são iniciados e concluídos no Execution, em `POST /executions/:id/start` e
  `/finish`. O andamento de cada serviço fica em `PATCH /executions/:id/tasks/:serviceId` com
  `{ "status": "IN_PROGRESS" | "COMPLETED" }`.
- O orçamento é gerado pelo Billing: serviços mais preço da peça vezes a quantidade.
- Aprovação e rejeição pelo cliente em `PATCH /service-orders/:id/budget`, atendida pelo Billing, com
  `{ status: "APPROVED" | "REJECTED", code }`. O `code` são os 4 primeiros dígitos do CPF/CNPJ: o token
  diz *quem* está agindo, o código diz que a pessoa quis aprovar *aquele* orçamento.
- Autorização por papel: atendente (clientes, veículos, abertura de OS), mecânico (diagnóstico, reparo,
  entrega), admin (catálogo e pagamento simulado).

## Execução via CLI (newman)

Local, com o compose de ponta a ponta no ar:

```bash
npx newman run postman/car-repair-shop.postman_collection.json \
  -e postman/car-repair-shop.postman_environment.json
```

AWS, pelo API Gateway (para no pagamento; ver "Pagamento na AWS"):

```bash
npx newman run postman/car-repair-shop.postman_collection.json \
  -e postman/car-repair-shop-k8s.postman_environment.json \
  --folder "00 - Setup" --folder "01 - Catalog (admin)" \
  --folder "02 - Customer and Vehicle (attendant)" --folder "03 - Fluxo da saga (ate o pagamento)"
```

> Alteração para demonstração