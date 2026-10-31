# ADR-016 (Banco de dados por serviço)

- **Status:** Aceito
- **Data:** 2026-10-31
- **RFC de origem:** RFC-002 (escolha do PostgreSQL para o domínio da oficina)

## Contexto

Até a Fase 3, uma instância PostgreSQL guarda tudo: clientes, catálogo, estoque, ordens de serviço e
funcionários. Com a divisão do ADR-013, manter esse banco compartilhado anularia a divisão. Qualquer serviço
poderia ler a tabela do outro, uma migration de um quebraria o outro, e um pico de consultas num derrubaria
os três.

A pergunta deixa de ser "qual banco" e passa a ser "qual banco para cada serviço", escolhido pelo que cada
um faz com os dados, e como garantir que nenhum leia o do outro.

Os padrões de acesso são diferentes:

- **OS:** consultas por status, por cliente, por período, com junções entre ordem, serviços e peças, e a
  reserva de estoque como escrita concorrente. É o domínio relacional que motivou a RFC-002.
- **Billing:** orçamento com linhas e pagamento ligado a ele. Pouco volume, muita exigência: um pagamento
  não pode ser confirmado duas vezes, e o valor confirmado precisa bater com o orçamento.
- **Execution:** um documento por ordem (etapa, status, datas e as tarefas de cada serviço), lido e gravado
  sempre inteiro e sempre pelo id da ordem, mais a fila por status em ordem de chegada.

## Alternativas

| Alternativa | A favor | Contra |
|---|---|---|
| Um recurso por serviço, tecnologia escolhida pelo padrão de acesso: PostgreSQL no OS, PostgreSQL no Billing, DynamoDB no Execution | Isolamento real de dados, credencial e falha. Cada banco do jeito que o serviço lê. Restrição de unicidade e transação ACID onde há dinheiro. | Três bancos para provisionar e acompanhar. Duas tecnologias de persistência no sistema. Uma instância RDS a mais custa e demora a subir. |
| Um servidor PostgreSQL, com um banco e um usuário por serviço | Uma instância só, menor custo, mesmo motor para tudo | O isolamento é de permissão, não de recurso: uma consulta pesada de um serviço afeta os outros, e uma falha do servidor derruba os três. Nada no próprio banco impede que um usuário receba permissão a mais por engano. |
| Manter o banco único compartilhado | Nenhuma mudança, transações entre áreas continuam possíveis | É o anti-padrão de banco compartilhado: a divisão em serviços passa a existir só no código, e o acoplamento continua no dado |
| DynamoDB no Billing e PostgreSQL no Execution | Também atende à persistência poliglota | Troca as garantias de lugar: o pagamento perderia a unicidade declarativa e a transação entre orçamento e pagamento, e o documento de execução ganharia tabelas e junções sem precisar delas |
| MongoDB dentro do cluster, para o Execution | Modelo de documento natural para a execução | Volta ao banco auto-hospedado, com estado dentro do cluster, que a Fase 3 deixou de lado (RFC-002). O serviço gerenciado compatível não está disponível no ambiente da AWS usado. |

## Critérios de decisão

- **Isolamento:** de dado, de credencial, de falha e de deploy de infraestrutura.
- **Aderência ao padrão de acesso** de cada serviço.
- **Garantias onde há dinheiro:** unicidade e transação ACID no pagamento.
- **Custo operacional** e tempo de criação num ambiente recriado a cada sessão.

## Decisão

| Serviço | Banco | Recurso | Provisionado por | Quem recebe a credencial |
|---|---|---|---|---|
| OS | PostgreSQL 16 (RDS) | instância `car-repair-shop-db` | `fiap-tech-challenge-infra-db` | só o deployment do OS |
| Billing | PostgreSQL 16 (RDS) | instância `car-repair-shop-billing-db` | `terraform/` do repositório do Billing | só o deployment do Billing |
| Execution | DynamoDB | tabelas `car-repair-shop-executions`, `car-repair-shop-execution-outbox`, `car-repair-shop-execution-processed-messages` | `terraform/` do repositório do Execution | só o deployment do Execution recebe os nomes das tabelas |

Cada banco tem estado de infraestrutura próprio: aplicar a infraestrutura de um nunca toca o estado de
outro.

### Modelo do Execution, pelo padrão de acesso

- Buscar a execução de uma ordem: chave de partição `serviceOrderId`.
- Listar a fila: índice secundário `status-queuedAt` (partição pelo status, ordenação pela hora de entrada).
- Calcular o tempo médio por serviço: varredura das execuções concluídas. Aceitável no volume da oficina;
  com volume maior, o caminho é manter um agregado por serviço atualizado a cada tarefa concluída.
- As tarefas de cada serviço ficam embutidas no documento da execução, porque são sempre lidas e gravadas
  junto com ele.

### Isolamento

No RDS, o isolamento é por recurso: instâncias diferentes, senhas diferentes, e cada deployment só recebe a
própria URL de conexão. No DynamoDB e nas filas, o isolamento é por configuração: cada deployment só recebe
os nomes de tabela e as URLs de fila que são seus, e nenhum código lê recurso de outro serviço.

O ambiente da AWS usado no projeto não permite criar papéis de acesso por serviço. Todos os pods herdam o
mesmo papel do node group, então, tecnicamente, a permissão de ler uma tabela do Execution existe em
qualquer pod. Fora desse ambiente, cada serviço teria uma service account associada a um papel próprio, com
acesso apenas aos seus recursos.

### Consultas que cruzam serviços

Nenhuma consulta vai ao banco de outro serviço. O que um serviço precisa saber do outro chega na mensagem: o
OS guarda o total do orçamento recebido em `BudgetGenerated` para responder a consulta de status, e o Billing
recebe as linhas já precificadas e o contato do cliente no comando de orçamento (ADR-015). É composição por
dado replicado na mensagem, não por consulta.

## Por que vence

O isolamento por recurso é o único que a própria plataforma garante. Com um servidor compartilhado, a
separação depende de as permissões estarem certas para sempre; com instâncias separadas, um serviço não tem
nem o endereço do banco do outro. A falha também fica contida: uma consulta pesada no OS não deixa o
Billing sem conexão.

Cada escolha de tecnologia sai do padrão de acesso. O Billing fica no PostgreSQL porque o pagamento precisa
de restrição de unicidade (uma notificação repetida do provedor não pode confirmar duas vezes) e de
transação entre orçamento e pagamento. O Execution vai para o DynamoDB porque o dado dele é um documento lido
pela chave, que é o caso de uso do armazenamento chave-valor, sem junção e sem esquema rígido a migrar.

O custo assumido é operacional: três bancos e duas tecnologias. É o preço normal de persistência
poliglota, e é compensado por cada serviço poder evoluir o próprio modelo sem coordenar com os outros.

## Consequências

### Positivas

- Nenhum serviço tem como ler o banco de outro: o endereço e a credencial simplesmente não chegam até ele
- Migrations independentes: o esquema de um serviço muda sem coordenação
- Cada banco com as garantias que o serviço precisa

### Negativas

- Três bancos para provisionar, acompanhar e destruir a cada sessão
- Duas tecnologias de persistência, com testes de integração diferentes (PostgreSQL e DynamoDB local)
- Relatórios que cruzam áreas passam a exigir composição na aplicação, porque não existe mais junção entre
  bancos
- A instância RDS a mais aumenta custo e tempo de subida do ambiente

### Riscos aceitos

- Isolamento por configuração, e não por permissão, no DynamoDB e nas filas, pelo limite do ambiente da AWS
  usado
- Varredura para o tempo médio por serviço, aceitável só enquanto o volume for o da oficina

## Quando revisitar

Se o ambiente passar a permitir papéis por serviço (o isolamento por permissão entra), se o tempo médio por
serviço ficar lento, ou se aparecer um relatório que cruze áreas com frequência, caso em que uma base de
leitura alimentada por eventos passa a valer a pena.
