# RFC-002 (Escolha do banco de dados gerenciado)

- **Status:** Aceita
- **Data:** 2026-08-28

## Contexto

A aplicação nasceu em MongoDB, com o banco rodando dentro do próprio cluster. Só que o domínio da
oficina é bem relacional: um cliente tem veículos, um veículo acumula ordens de serviço, e cada ordem
tem serviços e peças com atributos próprios.

Hoje nenhuma dessas relações é garantida pelo banco. Um identificador de cliente inexistente entra sem
erro. O problema só aparece quando alguém tenta ler a ordem de serviço, muito depois de o dado errado
ter entrado, e longe do código que o gravou.

O mesmo vale para o estoque. A regra de que o reservado nunca passa do disponível existe só no código
da aplicação, que roda em várias réplicas ao mesmo tempo.

Trocar para infraestrutura gerenciada é a chance de decidir se essas garantias continuam na aplicação
ou passam para o banco.

## Alternativas avaliadas

### RDS PostgreSQL

A favor: integridade referencial e restrições de domínio garantidas pelo banco, não por convenção.
Consultas analíticas (tempo médio por status, volume por período) saem em SQL direto. Operação
gerenciada, com backup e atualização automáticos.

Contra: exige reescrever os seis adaptadores de persistência, o povoamento inicial e a suíte de testes
de integração. O agregado de ordem de serviço deixa de ser um documento único e vira três tabelas, o
que torna as escritas transacionais.

### RDS MySQL

A favor: os mesmos ganhos de integridade, com custo de migração igual.

Contra: tipos menos expressivos para o que o domínio pede, e comportamento historicamente menos
previsível em restrições de verificação. Como é justamente esse o mecanismo escolhido para a regra de
estoque, o ponto pesa.

### MongoDB Atlas

A favor: custo de migração zero. Adaptadores, esquemas e testes ficam como estão. O modelo de agregado
combina bem com a leitura da ordem completa, que é a consulta mais frequente do sistema e sai numa
busca só, sem junção. O time já conhece a ferramenta, e a operação vira gerenciada sem mudar uma linha
de código.

Contra: a integridade referencial continua sendo responsabilidade da aplicação, e a regra de estoque
continua sujeita a corrida entre réplicas. Consultas analíticas exigem pipeline de agregação, mais
verboso e mais difícil de revisar que o SQL equivalente. E fica fora da AWS, o que quebra a coerência
de provisionar tudo pelo mesmo código de infraestrutura.

### DynamoDB

A favor: totalmente gerenciado, escala sem operação.

Contra: o modelo de chave exige desenhar as tabelas a partir dos padrões de acesso, e os deste sistema
são variados (por status, por cliente, por período). A reescrita seria bem maior que a do PostgreSQL,
para um ganho que o volume da oficina não justifica.

## Critérios de decisão

| Critério | Por que pesa |
|---|---|
| Integridade garantida pelo banco | Decide se uma classe inteira de bug vira erro impossível ou continua dependendo de disciplina |
| Custo de migração | A janela de trabalho é curta, e a migração compete com o resto da fase |
| Expressividade analítica | Os painéis de tempo médio por status e volume por período dependem disso |
| Operação gerenciada | Tira do grupo backup, atualização e disponibilidade |
| Disponibilidade no provedor escolhido | Restrição herdada da RFC-001 |

## O que o domínio pede

| Relação | Cardinalidade | Como está hoje | Como fica no relacional |
|---|---|---|---|
| Cliente para veículos | 1:N | identificador como texto livre, sem garantia | Chave estrangeira |
| Ordem de serviço para cliente e veículo | N:1 | textos livres | Chaves estrangeiras |
| Ordem e serviços | N:N com início e fim | array embutido | Tabela associativa |
| Ordem e peças | N:N com quantidade | array embutido | Tabela associativa |
| Peça e estoque reservado | reservado nunca passa do disponível | só na aplicação | Restrição de verificação |

## Recomendação

RDS PostgreSQL 16.

O argumento central é a integridade. Levar as garantias para o banco transforma uma classe inteira de
bug em erro impossível. Uma ordem de serviço com veículo inexistente deixa de ser algo que se descobre
em produção e passa a ser algo que o banco recusa na escrita. Com o estoque acontece o mesmo: sob
corrida, a restrição recusa a operação em vez de deixar o dado corromper em silêncio.

O segundo argumento é a expressividade analítica. Tempo médio por status e volume por período são os
painéis que o sistema precisa mostrar. Em SQL são consultas diretas. Em pipeline de agregação viram
código que ninguém revisa com atenção.

Sobre o custo de migração, que é o contra-argumento mais forte do Atlas: ele foi medido antes da
decisão, não estimado. A arquitetura em camadas já isola a persistência atrás de interfaces definidas
pela camada de casos de uso.

| Verificação no código atual | Resultado |
|---|---|
| Driver de banco fora das camadas de infraestrutura e adaptadores | Nenhuma ocorrência |
| Camadas internas importando de adaptadores ou infraestrutura | Nenhuma ocorrência |
| Linhas totais dos seis adaptadores | 308 |
| Acoplamento dos testes de integração | Nome das classes e um arquivo de configuração |

São 308 linhas. Esse é o raio de explosão inteiro da troca em código de produção. O que tornaria a
migração cara (regra de negócio grudada no driver) não existe aqui. O Atlas venceria se o custo fosse
alto. Medido, ele não é.

## Ajustes no modelo

O agregado de ordem de serviço, hoje um documento único com arrays embutidos, passa a três tabelas: a
ordem e duas associativas, para serviços e peças. Escritas que tocam as linhas associadas passam a ser
transacionais.

As tabelas associativas ganham chave própria em vez de chave composta. O motivo é que o domínio permite
que a mesma ordem registre o mesmo serviço em momentos diferentes, cada linha com seu próprio início e
fim. Uma restrição de unicidade preserva o comportamento atual sem fechar essa porta.

Índices, cada um com a consulta que sustenta:

| Índice | Consulta |
|---|---|
| `service_orders(status, created_at)` | Listagem ativa ordenada por prioridade |
| `service_orders(customer_id)` | Ordens de um cliente e verificação de titularidade |
| `vehicles(customer_id)` | Veículos de um cliente |
| `customers(tax_id)` | Consulta por documento na autenticação (caminho quente) |

O modelo completo, com colunas, restrições e a explicação de cada relacionamento, está em
[data-model.md](../data-model.md).

## Consequências

Positivas:

- Integridade referencial e regras de domínio garantidas pelo banco
- Consultas analíticas em SQL
- Backup, atualização e disponibilidade fora do escopo do grupo
- O banco sobe pelo mesmo código de infraestrutura do resto

Negativas:

- Reescrita dos seis adaptadores, do povoamento e da suíte de integração
- A leitura da ordem completa passa a exigir junção, onde antes era uma busca só
- Os testes de integração passam a depender de um contêiner de banco, o que deixa a suíte mais lenta

Risco aceito:

- Migração de dados fica fora do escopo. O ambiente é efêmero e o banco nasce vazio, povoado por
  script. Num sistema com dados reais, esta RFC precisaria de uma seção inteira sobre isso.
