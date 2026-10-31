# ADR-013 (Decomposição em três microsserviços)

- **Status:** Aceito
- **Data:** 2026-10-31

## Contexto

A oficina passou a operar com várias filiais, e as áreas que a aplicação atende (atendimento, diagnóstico,
execução e cobrança) cresceram em ritmos diferentes. Hoje todas vivem no mesmo processo, no mesmo banco e
no mesmo deploy: uma mudança na regra de cobrança sobe junto com a fila da oficina, e um pico de abertura
de ordens disputa CPU com o mecânico registrando o andamento do reparo.

A Fase 3 deixou o terreno preparado. A Dependency Rule está respeitada, a telemetria já segue convenções
que sobrevivem à decomposição (ADR-007), e as notificações foram o primeiro contexto extraído. O mapa de
contextos daquele ADR é o ponto de partida desta decisão.

A pergunta é por onde cortar. Cortar errado produz um monolito distribuído: serviços que só funcionam
juntos, que precisam de deploy coordenado e que trocam mensagens a cada operação.

## Operações e integrações

O método é listar cada operação, o serviço que fica com ela e com quem ela precisa conversar. Cada linha
aponta para o caso de uso que existe hoje, para que a divisão possa ser conferida contra o código.

| Serviço | Operação | Caso de uso hoje | Integração |
|---|---|---|---|
| OS | Abrir a ordem e reservar o estoque | `CreateServiceOrderUseCase` | Execution (pede o diagnóstico) |
| OS | Consultar status e histórico | `GetServiceOrderUseCase`, mais o histórico de status | — |
| OS | Ajustar serviços e peças no diagnóstico | `AddServiceToOSUseCase`, `AddItemToOSUseCase` e as remoções | — |
| OS | Entregar o veículo | `DeliverOSUseCase` | — |
| OS | Cadastros de clientes, veículos, catálogo, estoque e funcionários | `customers/`, `vehicles/`, `services/`, `items/`, `auth/` | Função de autenticação (consulta por CPF) |
| Billing | Gerar o orçamento | `CalculateBudgetUseCase` | OS (recebe as linhas, devolve o total) |
| Billing | Registrar a decisão do cliente | `ApproveBudgetUseCase`, `RejectBudgetUseCase` | OS (aprovação ou rejeição) |
| Billing | Cobrar e confirmar o pagamento | novo | Mercado Pago; OS (pagamento confirmado ou recusado) |
| Execution | Fila, diagnóstico e reparo | `StartDiagnosisUseCase`, `FinishDiagnosisUseCase`, `StartExecutionUseCase`, `FinishOSUseCase` | OS (início e fim de cada etapa) |
| Execution | Andamento por serviço e tempo médio | `StartServiceUseCase`, `FinishServiceUseCase`, `GetAvgExecutionTimeUseCase` | — |

## Alternativas

| Alternativa | A favor | Contra |
|---|---|---|
| Três serviços: OS, Billing e Execution | Cada um muda por um motivo de negócio diferente: dinheiro, trabalho de oficina, e o agregado da ordem que amarra os dois. A reserva de estoque continua uma transação local, dentro do OS. | O OS fica maior que os outros dois, com cadastros, ordens e a coordenação do fluxo. Três repositórios, três bancos e três pipelines para manter. |
| Quatro serviços, com cadastros e catálogo à parte | OS menor e mais focada. Catálogo e estoque poderiam escalar sozinhos. | A abertura de uma ordem passa a depender de outro serviço para validar cliente, veículo e preço, ou de cópias desses dados no OS. A reserva de estoque vira uma etapa distribuída, com compensação própria. Mais um repositório, banco e pipeline sem ganho visível para quem usa o sistema. |
| Divisão por camada técnica (API, processamento e dados) | Corte simples de explicar e de implantar | Toda operação de negócio atravessa as três partes. É o monolito distribuído: o acoplamento continua igual, agora com rede no meio. |
| Manter o monolito modular | Transação ACID em todo o fluxo, um deploy, nenhuma mensageria nova | As áreas continuam presas ao mesmo ciclo de deploy e à mesma escala. O banco único segue compartilhado por todos os módulos, e nada impede que um módulo leia a tabela do outro. |

## Critérios de decisão

- **Coesão:** o que muda pelo mesmo motivo fica junto.
- **Acoplamento transacional:** quantas operações passam a cruzar fronteira de serviço e precisar de
  coordenação distribuída.
- **Granularidade:** serviço pequeno demais gera conversa demais; grande demais perde coesão.
- **Autonomia:** cada serviço consegue ser implantado e escalado sem os outros.
- **Custo operacional:** repositórios, bancos e pipelines a manter.

## Decisão

Três serviços:

| Serviço | Repositório | Responsabilidade |
|---|---|---|
| OS Service | `fiap-tech-challenge` | Ordem de serviço (abertura, status, histórico, entrega), cadastros de clientes, veículos, catálogo, estoque e funcionários, e a coordenação do fluxo distribuído (ADR-014) |
| Billing Service | `fiap-tech-challenge-billing` | Orçamento, decisão do cliente, cobrança no Mercado Pago e confirmação do pagamento |
| Execution Service | `fiap-tech-challenge-execution` | Fila de execução, diagnóstico e reparo: iniciar, acompanhar e finalizar os serviços de cada ordem |

**Stack.** Os serviços novos usam a stack do ADR-009 (Node 22, TypeScript, Express, Jest, pino,
OpenTelemetry). Três serviços com a mesma estrutura de pastas e o mesmo ferramental se leem do mesmo jeito,
e extrair um serviço vira copiar um esqueleto conhecido. Nenhum repositório importa código de outro: o
código de infraestrutura repetido é o preço de não acoplar o ciclo de deploy dos três a uma biblioteca
comum.

**Autenticação.** Cada serviço valida localmente o token de funcionário e o de cliente, com o mesmo segredo
guardado no armazenamento de parâmetros, como definido no RFC-003 e no ADR-002. O token é autocontido, e
nenhum serviço precisa consultar outro para saber quem está chamando.

**Dono da infraestrutura.** O que pertence a um serviço só fica sob a responsabilidade dele, com estado e
pipeline próprios: o banco do Billing e as tabelas do Execution nascem no `terraform/` de cada repositório,
e o banco do OS continua no `fiap-tech-challenge-infra-db`, repositório dedicado a ele desde a Fase 3. O que
os três usam juntos é plataforma e fica no `fiap-tech-challenge-infra-k8s`: o cluster, com um namespace por
serviço, o API Gateway, a observabilidade, o registro de imagens e as filas de mensagens. Aplicar a
infraestrutura do banco de um serviço nunca toca o estado de outro.

**Migração.** A troca é incremental, no padrão Strangler Fig com expand/contract. Primeiro os serviços novos
sobem e passam a responder; depois o gateway leva para eles as rotas correspondentes; só então o código
equivalente sai do OS. Entre um passo e outro, o sistema continua funcionando.

## Por que vence

Os cortes seguem os motivos de mudança. Orçamento e pagamento mudam por regra financeira e por causa do
provedor de pagamento; diagnóstico e reparo mudam pelo jeito de trabalhar da oficina; a ordem de serviço é
o agregado que sabe em que ponto cada atendimento está. Separados assim, uma troca de provedor de pagamento
não encosta na fila da oficina, e uma mudança no fluxo de reparo não sobe junto com a cobrança.

O acoplamento transacional fica no mínimo possível. As únicas operações que cruzam fronteira são as que de
fato envolvem as três áreas (abrir, orçar, aprovar, pagar e executar uma ordem), e elas formam um fluxo só,
coordenado num lugar só (ADR-014). A reserva de estoque, que é a escrita mais sensível à concorrência,
continua sendo transação local do OS.

A alternativa de quatro serviços tem a melhor aparência e o pior custo. Cadastro e catálogo são consultados
justamente na abertura da ordem, que é o ponto mais quente do fluxo. Separá-los obrigaria o OS a perguntar a
outro serviço antes de cada abertura, ou a manter cópias dos dados, e a reserva de estoque viraria uma etapa
distribuída com compensação própria. Mais complexidade para resolver um problema de escala que a oficina não
tem.

## Consequências

### Positivas

- Cobrança, execução e ordem de serviço passam a ter deploy e escala independentes
- Cada serviço tem fronteira de dados própria, e o acesso cruzado a banco deixa de ser possível por
  construção
- A estrutura igual nos três serviços reduz o custo de entender e manter cada um

### Negativas

- O OS concentra cadastros, ordens e a coordenação do fluxo, e é o maior dos três
- Três repositórios, três bancos e três pipelines, com código de infraestrutura repetido entre eles
- Uma operação que antes era uma chamada de função passa a ser mensagem entre processos, com tudo que isso
  traz: entrega pelo menos uma vez, ordem, falha parcial

### Riscos aceitos

- A granularidade é a mínima para separar as três áreas. Se o cadastro ganhar ciclo de vida próprio, o OS
  precisará ser dividido de novo.

## Quando revisitar

Se cadastros e catálogo passarem a mudar num ritmo diferente do da ordem de serviço, ou se o volume de
consultas ao catálogo exigir escala própria. Aí a alternativa de quatro serviços volta à mesa.
