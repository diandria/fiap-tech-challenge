# Linguagem Ubíqua — Car Repair Shop

Termos do domínio da oficina mecânica e suas contrapartidas no código. Referência para alinhamento entre negócio e engenharia.

> Diagramas visuais em `docs/ddd/`: Event Storming (`event-storming.png`), Linguagem Pictográfica (`linguagem-pictografica.png`).

---

## Termos do Domínio

| Termo (negócio) | Definição | Contraparte no código |
|---|---|---|
| **Cliente** | Pessoa física ou jurídica que solicita e aprova o serviço | `Customer` — entidade com `taxId` (CPF ou CNPJ) |
| **Veículo** | Bem do cliente que será atendido na oficina | `Vehicle` — vinculado a um `Customer` por `customerId` |
| **Ordem de Serviço (OS)** | Registro central que rastreia toda a execução, do recebimento à entrega | `ServiceOrder` — agregado principal; `services[]` e `items[]` são populados na abertura pelo atendente (com base no cliente) e refinados pelo mecânico durante o diagnóstico |
| **Diagnóstico** | Etapa em que o mecânico analisa o veículo com base na lista de serviços e peças informada pelo cliente na abertura da OS. O mecânico refina essa lista — adicionando o que for necessário e removendo o que não se aplicar — e encerra o diagnóstico com o orçamento calculado para aprovação | Fase `DIAGNOSIS` da OS; transições `DIAGNOSIS` e `WAITING_APPROVAL` via `PATCH /service-orders/:id` |
| **Serviço** | Atividade técnica executada no veículo (ex.: troca de óleo, alinhamento) | `Service` — entidade do catálogo com `name`, `price`, `estimatedMinutes` |
| **Item** | Peça ou insumo físico utilizado para executar um serviço | `Item` — entidade com controle de estoque (`stockQuantity`, `reservedQuantity`) |
| **Estoque** | Conjunto de itens disponíveis na oficina; rastreado por quantidades disponíveis e reservadas | Campos `stockQuantity` e `reservedQuantity` na entidade `Item` |
| **Orçamento** | Valor total calculado a partir dos serviços e itens da OS; enviado ao cliente para aprovação | `budgetTotal` — calculado na transição `DIAGNOSIS → WAITING_APPROVAL`, persistido como valor fixo |
| **Aprovação** | Decisão do cliente de autorizar a execução do serviço após receber o orçamento | Body `{ status: "APPROVED", code }` em `PATCH /service-orders/:id/budget`; transição `WAITING_APPROVAL → APPROVED` |
| **Rejeição** | Decisão do cliente de não autorizar o orçamento | Body `{ status: "REJECTED", code }` em `PATCH /service-orders/:id/budget`; transição `WAITING_APPROVAL → REJECTED` |
| **Execução** | Fase em que os serviços estão sendo realizados pelo mecânico | Status `EXECUTION`; entrada via `{ status: "EXECUTION" }` |
| **Entrega** | Devolução do veículo ao cliente após os serviços concluídos | Status `DELIVERED`; entrada via `{ status: "DELIVERED" }` |
| **Notificação ao cliente** | Mensagem que informa o cliente que o orçamento está pronto para aprovação | Port `INotificationService` (`domain/ports/`); adapter MVP `ConsoleNotificationService` loga em stdout; disparado best-effort na transição `DIAGNOSIS → WAITING_APPROVAL` |

---

## Atores

| Ator (negócio) | Definição | Role no sistema |
|---|---|---|
| **Atendente** | Recepção: cadastra cliente/veículo, abre a OS | `attendant` |
| **Mecânico** | Execução técnica: diagnóstico, serviços/itens, execução, entrega | `mechanic` |
| **Admin** | Acesso total; gerencia usuários, catálogo de serviços e estoque | `admin` |
| **Cliente** | Consulta o status da OS e aprova/rejeita o orçamento via código de verificação | público (sem JWT) |

---

## Conceitos Técnicos do Domínio

| Conceito | Definição |
|---|---|
| **Código de aprovação** | Primeiros 4 dígitos do CPF ou CNPJ do cliente. Usado para autenticar a aprovação/rejeição de orçamento sem login. Ex.: CPF `529.982.247-25` → código `5299` |
| **Reserva de estoque** | Quantidade de um item separada para uma OS específica, mas ainda não consumida. Incrementada quando o item é adicionado à OS; decrementada quando a execução começa (consumo) ou o orçamento é rejeitado (liberação) |
| **Preço congelado** | `budgetTotal` é calculado e armazenado na transição `DIAGNOSIS → WAITING_APPROVAL`. Mudanças posteriores no catálogo de serviços ou itens não afetam um orçamento já gerado |
| **Soft delete** | Clientes não são removidos fisicamente; recebem `deletedAt`. Preserva o histórico de OSs vinculadas |
| **taxId** | CPF (11 dígitos) ou CNPJ (14 dígitos) armazenado só como dígitos, sem formatação. `taxType` indica qual dos dois |

---

## Status da Ordem de Serviço

| Status (código) | Nome de negócio | Descrição |
|---|---|---|
| `RECEIVED` | Recebida | OS aberta; veículo aguardando diagnóstico |
| `DIAGNOSIS` | Em diagnóstico | Mecânico avaliando o veículo; adicionando serviços e itens |
| `WAITING_APPROVAL` | Aguardando aprovação | Orçamento gerado e enviado; aguardando decisão do cliente |
| `APPROVED` | Aprovada | Cliente autorizou; aguardando início da execução |
| `EXECUTION` | Em execução | Serviços sendo realizados |
| `FINISHED` | Finalizada | Todos os serviços concluídos; aguardando entrega |
| `DELIVERED` | Entregue | Veículo devolvido ao cliente (status terminal) |
| `REJECTED` | Rejeitada | Cliente não aprovou o orçamento (status terminal) |

---

## Divergências Conhecidas

| Item | Diagrama DDD | Código atual | Decisão |
|---|---|---|---|
| Quem executa o diagnóstico (start/finish) | Mecânico (Linguagem Pictográfica) | `mechanic` e `admin` | Ajustado em `feat/os-status-body` — transições de diagnóstico exigem `mechanic` ou `admin` |
| Envio do orçamento ao cliente | Comando explícito no Event Storming | `INotificationService` é disparado em `DIAGNOSIS → WAITING_APPROVAL`; adapter MVP é mock `console.log` | Transporte real (email/SMS) postergado para pós-MVP — port já está pronto, basta trocar o adapter |
