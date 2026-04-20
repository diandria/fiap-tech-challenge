# Linguagem Ubiqua — Car Repair Shop

Termos do dominio da oficina mecanica e seus equivalentes no codigo. Referencia para comunicacao entre negocio e desenvolvimento.

> Diagramas visuais em `docs/ddd/`: Event Storming, Linguagem Pictografica, Linguagem Ubiqua.

---

## Termos do Dominio

| Termo (negocio) | Definicao | Equivalente no codigo |
|---|---|---|
| **Cliente** | Pessoa fisica ou juridica que solicita e aprova o servico | `Customer` — entidade com `taxId` (CPF ou CNPJ) |
| **Veiculo** | Bem do cliente que sera atendido na oficina | `Vehicle` — vinculado a um `Customer` por `customerId` |
| **Ordem de Servico (OS)** | Registro central que controla todo o atendimento: do recebimento a entrega | `ServiceOrder` — agregado principal do sistema |
| **Diagnostico** | Analise tecnica do veiculo feita pelo mecanico para identificar o que precisa ser feito | Fase `DIAGNOSIS` da OS; comandos `start-diagnosis` e `finish-diagnosis` |
| **Servico** | Atividade tecnica executada no veiculo (ex: troca de oleo, alinhamento) | `Service` — entidade do catalogo com `name`, `price`, `estimatedMinutes` |
| **Item** | Peca ou insumo fisico utilizado na execucao de um servico | `Item` — entidade com controle de estoque (`stockQuantity`, `reservedQuantity`) |
| **Estoque** | Conjunto de itens disponiveis na oficina; controlado por quantidade disponivel e reservada | Campo `stockQuantity` e `reservedQuantity` na entidade `Item` |
| **Orcamento** | Valor total calculado com base nos servicos e itens incluidos na OS; enviado ao cliente para aprovacao | `budgetTotal` — calculado no `finish-diagnosis`, armazenado como valor fixo |
| **Aprovacao** | Decisao do cliente de autorizar a execucao dos servicos apos receber o orcamento | Comando `approve-budget`; transicao `WAITING_APPROVAL → APPROVED` |
| **Rejeicao** | Decisao do cliente de nao autorizar o orcamento | Comando `reject-budget`; transicao `WAITING_APPROVAL → REJECTED` |
| **Execucao** | Fase em que os servicos estao sendo realizados pelo mecanico | Status `EXECUTION`; iniciada pelo comando `start-execution` |
| **Entrega** | Devolucao do veiculo ao cliente apos finalizacao dos servicos | Status `DELIVERED`; comando `deliver` |

---

## Atores

| Ator (negocio) | Definicao | Role no sistema |
|---|---|---|
| **Atendente** | Responsavel pelo atendimento ao cliente: cadastro, abertura de OS, geracao de orcamento | `attendant` |
| **Mecanico** | Responsavel pela execucao tecnica: diagnostico, adicao de servicos/itens, execucao e entrega | `mechanic` |
| **Admin** | Acesso total; gerencia usuarios, catalogo de servicos e estoque | `admin` |
| **Cliente** | Consulta status da OS e aprova/rejeita orcamento via codigo de verificacao | publico (sem autenticacao JWT) |

---

## Conceitos Tecnicos do Dominio

| Conceito | Definicao |
|---|---|
| **Codigo de aprovacao** | Primeiros 4 digitos do CPF ou CNPJ do cliente. Usado para autenticar a aprovacao ou rejeicao do orcamento sem login. Ex: CPF `529.982.247-25` → codigo `5299` |
| **Reserva de estoque** | Quantidade de um item separada para uma OS especifica, mas ainda nao consumida. Incrementada ao adicionar item a OS; decrementada ao iniciar execucao (consumo) ou rejeitar orcamento (liberacao) |
| **Preco fixado** | O `budgetTotal` e calculado e armazenado no momento do `finish-diagnosis`. Alteracoes posteriores no catalogo de servicos ou itens nao afetam o orcamento ja gerado |
| **Soft delete** | Clientes nao sao removidos fisicamente; recebem `deletedAt`. Mantem historico de OS vinculadas |
| **taxId** | CPF (11 digitos) ou CNPJ (14 digitos) armazenado apenas como digitos, sem formatacao. `taxType` indica qual dos dois |

---

## Status da Ordem de Servico

| Status (codigo) | Nome no negocio | Descricao |
|---|---|---|
| `RECEIVED` | Recebida | OS aberta; veiculo aguardando diagnostico |
| `DIAGNOSIS` | Em diagnostico | Mecanico avaliando o veiculo; adicionando servicos e itens |
| `WAITING_APPROVAL` | Aguardando aprovacao | Orcamento gerado e enviado; aguardando decisao do cliente |
| `APPROVED` | Aprovada | Cliente autorizou; aguardando inicio da execucao |
| `EXECUTION` | Em execucao | Servicos sendo realizados |
| `FINISHED` | Finalizada | Todos os servicos concluidos; aguardando entrega |
| `DELIVERED` | Entregue | Veiculo devolvido ao cliente (status terminal) |
| `REJECTED` | Rejeitada | Cliente nao aprovou o orcamento (status terminal) |

---

## Discrepancias Conhecidas

| Item | Diagrama DDD | Codigo atual | Decisao |
|---|---|---|---|
| Quem adiciona servicos e itens a OS | Mecanico (Linguagem Pictografica) | `attendant` e `admin` | **Bug** — corrigir para `mechanic` e `admin` (Fase 1, item #1 dos gaps) |
| Envio do orcamento ao cliente | Comando explicito no Event Storming | Sem mecanismo de envio ativo; cliente consulta via endpoint publico | Decisao de MVP — sem canal de notificacao externo |
