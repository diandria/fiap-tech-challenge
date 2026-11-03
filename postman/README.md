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
`change-me-in-production` e `JWT_SECRET` igual ao `jwtSecret`. O Billing cobra no Payment Service, que o
compose sobe na porta 3003.

### AWS (EKS + API Gateway)

A aplicação não é alcançável diretamente: os NLBs são internos e o único caminho de entrada é o API
Gateway (ADR-001). Descubra a URL e preencha `baseUrl`, `billingBaseUrl`, `executionBaseUrl` e
`authBaseUrl`:

```bash
cd ~/dev/fiap-tech-challenge-infra-k8s && terraform output api_gateway_url
```

`adminPassword` e `jwtSecret` vêm do SSM:

```bash
aws ssm get-parameter --name /car-repair-shop/app/admin-password --with-decryption \
  --query Parameter.Value --output text
aws ssm get-parameter --name /car-repair-shop/auth/jwt-secret --with-decryption \
  --query Parameter.Value --output text
```

O `jwtSecret` é necessário mesmo com a função no ar. A pasta 03 age como cliente (consulta o status e aprova
o orçamento) antes de a pasta 11 buscar o token real em `/auth/cpf`, e até lá vale o token emitido pelo
script de pré-requisição. O token do "outro cliente", usado nos 403 da pasta 11, também sai desse script.
Assinados com outro segredo, os dois viram 401.

## Importação e execução no Runner

1. No Postman: **Import → Upload Files**, com a collection e o environment desejado (local ou AWS).
2. Escolha o environment no seletor do canto superior direito.
3. **Na AWS**, preencha no environment os seis valores que mudam a cada subida: `baseUrl`,
   `billingBaseUrl`, `executionBaseUrl` e `authBaseUrl` com a URL do API Gateway (a mesma nas quatro), e
   `adminPassword` e `jwtSecret` com os valores do SSM (ver acima). Vazios, o login do admin da pasta 00
   falha e o resto da coleção falha em cascata. **Localmente**, o environment já vem preenchido para o
   compose de ponta a ponta.
4. Abra a coleção, clique em **Run** e rode todas as pastas, na ordem em que aparecem. Os passos
   `Aguardar ...` se repetem sozinhos até a saga chegar ao estado esperado, e os valores que um passo grava
   no environment (tokens, ids, `checkoutUrl`) são os que os seguintes usam.

Na AWS, a coleção inteira roda sem falha. Localmente, a única falha esperada é o `/auth/cpf` da pasta 11,
porque a função de autenticação não roda no compose.

## Ordem de execução

Rode as pastas na ordem numerada, no **Collection Runner**. Cada request guarda no environment o que as
seguintes precisam (tokens, ids).

| # | Pasta | O que faz |
|---|---|---|
| 00 | Setup | Login do admin, cadastro de atendente e mecânico (aceita 201 ou 409), login dos dois papéis |
| 01 | Catalog (admin) | Um serviço (Troca de Óleo, R$ 120) e uma peça (Óleo 5W30, R$ 40, estoque 10) |
| 02 | Customer and Vehicle (attendant) | Cliente com CPF `96627075300` (código de aprovação `9662`) e veículo `ABC-1234` |
| 03 | Fluxo da saga (até o pagamento) | O atendente abre a OS; ela aparece na fila do mecânico (`GET /executions`); o mecânico inicia o diagnóstico no Execution; a OS vai a `DIAGNOSIS`; o mecânico inclui serviço e peça e conclui o diagnóstico; o Billing gera o orçamento; o cliente consulta o status e aprova no Billing; o Billing cria a cobrança e o `checkoutUrl` aparece no console |
| 04 | Pagamento no checkout | O cliente abre o link de pagamento do Payment Service e paga; o Payment Service avisa o Billing por um webhook assinado |
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

### Pagamento

O provedor de pagamento é o [Payment Service](https://github.com/diandria/fiap-tech-challenge-payment), o
simulador que a coordenação orientou criar no lugar do Mercado Pago. Quando o OS pede a cobrança, o
Billing troca as credenciais dele por um token no Payment Service, cria a cobrança e guarda o link de
pagamento. A última requisição da pasta 03 grava esse link no `checkoutUrl`, e a pasta 04 faz o papel do
cliente: abre o link e paga com `{ "status": "approved" }`. O Payment Service avisa o Billing por um webhook
assinado, e a pasta 05 espera a OS em `PAID`.

O link é `http://localhost:3003/checkout/<id>` no compose e `<URL do API Gateway>/checkout/<id>` na AWS;
nos dois casos a coleção roda de ponta a ponta sem intervenção. Para ver a compensação do pagamento
recusado, envie `{ "status": "rejected" }` no passo de pagar: a OS vai a `CANCELLED` e a peça volta ao
estoque.

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
função, e grava o token real. Antes dela, a pasta 03 usa o token emitido pelo script descrito abaixo, e por
isso o `jwtSecret` também é preenchido na AWS.

**Localmente não existe função.** O script de pré-requisição da coleção emite um token com o **mesmo
formato e o mesmo segredo** (`jwtSecret`) quando `customerToken` está vazio. É uma conveniência de
desenvolvimento, não parte do produto. Contra o gateway, o token real sobrescreve o emitido localmente.
Por isso a chamada a `/auth/cpf` da pasta 11 dá erro de URL quando roda localmente com `authBaseUrl`
vazio, e o resto da coleção segue.

> `jwtSecret` precisa bater com o `JWT_SECRET` dos serviços. No compose de ponta a ponta é
> `dev-secret-change-in-prod`; na AWS, é o parâmetro `/car-repair-shop/auth/jwt-secret` do SSM. Se
> divergir, o sintoma é um 401 sem mensagem útil.

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
  entrega), admin (catálogo).

## Execução via CLI (newman)

Local, com o compose de ponta a ponta no ar:

```bash
npx newman run postman/car-repair-shop.postman_collection.json \
  -e postman/car-repair-shop.postman_environment.json
```

AWS, pelo API Gateway:

```bash
API=$(cd ~/dev/fiap-tech-challenge-infra-k8s && terraform output -raw api_gateway_url)
ADMIN_PASSWORD=$(aws ssm get-parameter --name /car-repair-shop/app/admin-password \
  --with-decryption --query Parameter.Value --output text)
JWT_SECRET=$(aws ssm get-parameter --name /car-repair-shop/auth/jwt-secret \
  --with-decryption --query Parameter.Value --output text)

npx newman run postman/car-repair-shop.postman_collection.json \
  -e postman/car-repair-shop-k8s.postman_environment.json \
  --env-var "baseUrl=$API" --env-var "billingBaseUrl=$API" \
  --env-var "executionBaseUrl=$API" --env-var "authBaseUrl=$API" \
  --env-var "adminPassword=$ADMIN_PASSWORD" --env-var "jwtSecret=$JWT_SECRET"
```

