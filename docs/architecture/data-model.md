# Modelo de dados

Modelo relacional da oficina, com a explicação de cada relacionamento e das restrições que o banco passa
a garantir. Este documento é a fonte de verdade do esquema: a definição executável o traduz, e não o
contrário.

A justificativa da escolha do banco está na [RFC-002](rfc/RFC-002-banco-de-dados.md).

## Dono dos dados

Este documento descreve só o banco do OS Service. Desde a divisão em microsserviços
([ADR-013](adr/ADR-013-decomposicao-em-microsservicos.md)), cada serviço tem o próprio banco
([ADR-016](adr/ADR-016-banco-por-servico.md)): o modelo do Billing e o do Execution são documentados nos
repositórios deles, e nenhuma tabela daqui é lida por outro serviço.

## Diagrama

```mermaid
erDiagram
    customers ||--o{ vehicles : possui
    customers ||--o{ service_orders : solicita
    vehicles  ||--o{ service_orders : recebe
    service_orders ||--o{ service_order_services : contem
    service_orders ||--o{ service_order_items : contem
    services  ||--o{ service_order_services : referenciado_por
    items     ||--o{ service_order_items : referenciado_por
    service_orders ||--o{ service_order_status_history : registra

    customers {
        uuid id PK
        text name
        text tax_id UK
        enum tax_type
        text email
        text phone
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at "nulo quando ativo"
    }
    vehicles {
        uuid id PK
        uuid customer_id FK
        text plate UK
        text brand
        text model
        int year
    }
    services {
        uuid id PK
        text name
        numeric price "CHECK >= 0"
        int estimated_minutes "CHECK >= 0"
    }
    items {
        uuid id PK
        text name
        numeric price "CHECK >= 0"
        int stock_quantity "CHECK >= 0"
        int reserved_quantity "CHECK <= stock_quantity"
    }
    users {
        uuid id PK
        text email UK
        text password_hash
        enum role
    }
    service_orders {
        uuid id PK
        uuid customer_id FK
        uuid vehicle_id FK
        enum status
        numeric budget_total "nulo até o diagnóstico"
        timestamp created_at
        timestamp started_at
        timestamp finished_at
        timestamp delivered_at
        int version "controle otimista"
    }
    service_order_services {
        uuid id PK
        uuid service_order_id FK
        uuid service_id FK
    }
    service_order_items {
        uuid id PK
        uuid service_order_id FK
        uuid item_id FK
        int quantity "CHECK > 0"
    }
    service_order_status_history {
        uuid id PK
        uuid service_order_id FK
        enum from_status "nulo na abertura"
        enum to_status
        timestamp changed_at
    }
```

## Relacionamentos

Cada um responde três coisas: a cardinalidade, por que existe no negócio, e o que a chave estrangeira
impede que aconteça. Essa terceira é a parte que dá valor à migração.

### `vehicles.customer_id` → `customers.id` (N:1)

Um veículo pertence a um cliente; um cliente acumula vários veículos ao longo do tempo. A chave impede
cadastrar veículo para um cliente que não existe. Hoje, com o identificador como texto livre, isso passa
sem erro e só aparece quando alguém tenta listar os veículos daquele cliente e recebe uma lista vazia
sem explicação.

### `service_orders.customer_id` → `customers.id` (N:1)

Uma ordem de serviço é sempre de um cliente; um cliente acumula ordens ao longo do tempo. A chave impede
abrir ordem para cliente inexistente, e é o que garante que a verificação de titularidade, que decide
quem pode aprovar um orçamento, tenha em que se apoiar.

### `service_orders.vehicle_id` → `vehicles.id` (N:1)

Uma ordem existe sempre para um veículo específico; um veículo acumula várias ordens. A chave impede
abrir ordem para veículo não cadastrado. Sem ela, o erro só é descoberto quando a ordem é consultada,
longe, no tempo e no código, de onde o dado errado entrou.

### `service_order_services` (N:N entre ordens e serviços)

Uma ordem contém vários serviços, e um serviço do catálogo aparece em várias ordens. A tabela existe
porque a relação **tem atributos próprios**: quando aquele serviço começou e quando terminou, naquela
ordem específica. Sem a tabela associativa, esses dois campos não teriam onde morar.

A restrição de unicidade sobre o par impede registrar o mesmo serviço duas vezes na mesma ordem.

### `service_order_items` (N:N entre ordens e peças)

Mesma estrutura, com um atributo diferente: a quantidade daquela peça naquela ordem. A restrição
`quantity > 0` impede registrar uma peça com quantidade zero ou negativa, o que corromperia o cálculo do
orçamento em silêncio.

### `service_order_status_history` (1:N a partir da ordem)

Cada mudança de status da ordem vira uma linha, com o status de origem, o de destino e o momento. A
abertura é registrada com origem nula. As colunas de horário da própria ordem (`started_at`,
`finished_at`, `delivered_at`) contam só três momentos; o histórico conta todos, inclusive os que não
têm coluna, como a entrada em diagnóstico ou a aprovação do orçamento.

O registro é feito na mesma transação que muda o status, então não existe mudança sem histórico. A
remoção em cascata acompanha a ordem: histórico de uma ordem que não existe mais não tem utilidade.

### `users`, isolada de propósito

A tabela não tem nenhuma chave estrangeira, e não é esquecimento. O funcionário é um ator do sistema, não
um participante do negócio da oficina: ele não é dono de veículo nem de ordem de serviço. A ausência de
relacionamento é a modelagem correta.

O contraste com `customers` ajuda a ver. As duas guardam pessoas, e têm papéis opostos no modelo. Uma
está no centro, com relacionamentos para quase tudo. A outra não é referenciada por nada e não referencia
nada. Se um dia for preciso saber qual mecânico executou qual serviço, aí aparece um relacionamento, e
será uma decisão nova, com registro próprio.

### `outbox_messages`, mensagens a publicar

Guarda as mensagens que o OS precisa enviar a outros serviços, gravadas na mesma transação da mudança que
as produziu ([ADR-015](adr/ADR-015-comunicacao-e-contrato-de-mensagens.md)). É isso que garante que a
mudança e a mensagem existem juntas: se a transação falha, nenhuma das duas fica. Um processo separado
publica as pendentes, em ordem de criação, e preenche `published_at`.

A tabela não tem chave estrangeira para `service_orders`, de propósito. A mensagem é um registro do que foi
decidido, e continua válida como histórico de publicação mesmo que a ordem deixe de existir.

| Coluna | Uso |
|---|---|
| `id` | Id da mensagem; vira o `messageId` do envelope e a chave de deduplicação na fila |
| `destination` | Fila de destino (`billing-commands`, `execution-commands`) |
| `type`, `payload` | Tipo e conteúdo da mensagem |
| `service_order_id` | Ordem a que a mensagem se refere; vira o grupo de ordenação na fila |
| `traceparent` | Contexto de rastreamento de quem gravou, para o consumidor continuar o mesmo trace |
| `published_at` | Nulo até ser publicada |

### `processed_messages`, mensagens já tratadas

As filas entregam cada mensagem pelo menos uma vez, então a mesma resposta pode chegar duas vezes. O id de
toda mensagem tratada é gravado aqui, na mesma transação do efeito que ela produz. Quando a mesma mensagem
chega de novo, o registro já existe, e ela é confirmada sem efeito nenhum.

A gravação ignora o duplicado em vez de falhar com violação de unicidade: no PostgreSQL, um comando que
falha dentro de uma transação aborta a transação inteira, e o consumidor ainda precisa dela para terminar.

## Restrições de domínio

O que deixa de depender de disciplina da aplicação e passa a ser garantido pelo banco:

| Restrição | O que impede |
|---|---|
| `items.reserved_quantity <= items.stock_quantity` | Reservar peça além do estoque disponível, inclusive sob corrida entre réplicas |
| `items.stock_quantity >= 0` e `reserved_quantity >= 0` | Estoque negativo |
| `service_order_items.quantity > 0` | Peça com quantidade nula ou negativa no orçamento |
| `services.price >= 0` e `estimated_minutes >= 0` | Valor ou duração negativos no catálogo |
| `customers.tax_id` único | Dois cadastros para o mesmo documento |
| `vehicles.plate` única | Dois cadastros para a mesma placa |
| `status` como tipo enumerado | Status fora da máquina de estados |

A primeira é a mais relevante. Hoje o invariante é sustentado por código de aplicação que roda em várias
réplicas simultâneas: duas reservas concorrentes podem ler o mesmo valor e ambas escrever, perdendo um
incremento. Com a restrição no banco, a operação falha em vez de corromper o dado em silêncio.

## Índices

Cada um existe por causa de uma consulta específica:

| Índice | Consulta que sustenta |
|---|---|
| `service_orders(status, created_at)` | Listagem de ordens ativas, ordenada por prioridade operacional |
| `service_orders(customer_id)` | Ordens de um cliente e verificação de titularidade |
| `vehicles(customer_id)` | Veículos de um cliente |
| `customers(tax_id)` | Consulta por documento na autenticação (caminho quente, executado a cada login de cliente) |
| `service_order_status_history(service_order_id, changed_at)` | Histórico de uma ordem, em ordem cronológica |
| `outbox_messages(published_at, created_at)` | Mensagens ainda não publicadas, na ordem em que foram gravadas |

## Decisões de modelagem

Sobre `service_orders.version`: toda escrita na ordem incrementa a versão, e quem leu a ordem antes de
decidir pode exigir que ela ainda esteja na versão lida. Se outra escrita chegou antes, a atualização é
recusada com conflito em vez de sobrescrever a outra. É controle otimista: não segura bloqueio enquanto o
caso de uso decide, só confere no momento de gravar.

Sobre as tabelas associativas terem chave própria em vez de chave composta pelos dois identificadores: a
chave composta seria mais enxuta, mas fecharia a porta para o domínio permitir que a mesma ordem registre
o mesmo serviço em momentos distintos. A chave própria mantém essa possibilidade aberta sem migração
futura, e a restrição de unicidade preserva o comportamento atual. O início e o fim de cada serviço
saíram desta tabela na Fase 4: são registrados pelo Execution Service, como tarefas do reparo.

Sobre valores monetários usarem tipo decimal e não ponto flutuante: ponto flutuante acumula erro de
arredondamento, e o total do orçamento, que o Billing calcula e o OS guarda, soma preços de serviços e
peças. O erro é pequeno em cada operação e visível na fatura.

Sobre a exclusão de cliente ser lógica e não física: o campo de data de exclusão preserva o histórico de
ordens de serviço, que continuam válidas para consulta. Um cliente excluído deixa de aparecer nas
listagens e de autenticar, mas suas ordens permanecem.
