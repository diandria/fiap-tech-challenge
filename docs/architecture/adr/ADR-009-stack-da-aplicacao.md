# ADR-009 (Stack da aplicação)

- **Status:** Aceito
- **Data da decisão:** Fase 1 (aproximada)
- **Data do registro:** 2026-08-28

## Contexto

Este é um registro retroativo. A stack foi escolhida na primeira fase e nunca documentada.

Registrar agora tem dois motivos. Quem chega ao repositório hoje não tem como saber por que esta e não
outra. E a decomposição futura vai obrigar a decidir se cada serviço novo herda a mesma stack, pergunta
impossível de responder sem os critérios originais escritos.

A escolha de linguagem, runtime e framework HTTP condiciona tempo de inicialização, consumo de memória,
ferramental de teste e o que é viável nas Lambdas.

## Alternativas

| Alternativa | A favor | Contra |
|---|---|---|
| Node com TypeScript e Express | Mesma linguagem na aplicação e nas Lambdas. Inicialização rápida e pegada de memória pequena. Tipagem estática sem runtime pesado. Auto-instrumentação do OpenTelemetry madura. | Single-threaded, então trabalho intensivo de CPU bloqueia o event loop. `any` e casts permitem furar a tipagem. O Express não impõe estrutura. |
| Node com NestJS | Estrutura pronta, injeção de dependência embutida, convenções fortes | O contêiner de DI do Nest competiria com o Composition Root explícito em `main.ts`, escondendo o grafo de dependências que a Clean Architecture quer deixar à mostra |
| Java com Spring Boot | Ecossistema corporativo maduro, concorrência real por threads, tipagem sem escapatória | Inicialização e heap bem maiores, o que é problema direto em nós `t3.small` e em cold start de Lambda. As Lambdas seguiriam noutra linguagem de qualquer forma. |
| Python com FastAPI | Produtividade alta, e tipagem opcional com Pydantic | Sem garantia em tempo de compilação, e o GIL limita paralelismo |
| Go | Menor pegada de memória de todas, concorrência nativa, binário único | Curva de aprendizado para o time. Mais verboso para CRUD. Ecossistema de ORM menos maduro. |

## Critérios de decisão

Memória e tempo de inicialização, garantia de contrato em tempo de compilação, unicidade de linguagem
entre aplicação e Lambdas, maturidade da auto-instrumentação do OpenTelemetry, e familiaridade do grupo.

## Decisão

Node 20 LTS, TypeScript 5.3 e Express 4, empacotados em `node:20-alpine`.

## Por que vence

O primeiro motivo é ter uma linguagem em todo o sistema. As duas Lambdas são TypeScript, como a aplicação,
então é um `tsconfig`, um ESLint, um Jest, um conjunto de convenções. Com Java ou Go na aplicação, as
Lambdas seguiriam noutra linguagem de qualquer forma, por causa do cold start, e o projeto teria duas
stacks para manter desde o primeiro dia.

O segundo é que o compilador sustenta a arquitetura. A Dependency Rule é verificável em tempo de
compilação: um gateway que não implementa o Output Port declarado pela camada de casos de uso não compila.
Isso não é teoria. Foi essa garantia que permitiu medir que a migração para PostgreSQL custaria 308
linhas. Sem tipagem estática, a regra vira convenção, e convenção é o que se quebra sob prazo.

O terceiro é que cabe no ambiente. Centenas de milissegundos para subir e algumas dezenas de megabytes de
heap importam num node group de `t3.small` que ainda hospeda Prometheus, Grafana, Loki e Tempo.

Sobre Express e não NestJS: o Nest resolveria injeção de dependência e estrutura, que é exatamente o que
este projeto resolve à mão, de propósito, com um Composition Root explícito em `main.ts`. Adotar o
contêiner do Nest esconderia o grafo de dependências que a Clean Architecture existe para tornar visível,
e a separação em camadas viraria decoração sobre decorators do framework. O Express não opina, e é isso
que se quer: a arquitetura é a opinião. O custo honesto é mais código de ligação escrito à mão, e nenhuma
rede de proteção quando alguém instancia algo no lugar errado.

Pensando na decomposição futura, stack única significa um template de workflow, uma imagem base, uma
instrumentação. Extrair um serviço vira copiar um esqueleto conhecido, não montar um ambiente novo. Mas
poliglotismo é benefício legítimo de microsserviços, e padronizar abre mão dele por padrão. O que preserva
a porta aberta é a telemetria em OpenTelemetry (ADR-007): um serviço futuro em Go ou Java entra nos mesmos
dashboards sem adaptação. A padronização é escolha padrão, não regra.

## Consequências

Positivas:

- Uma stack, um ferramental, um conjunto de convenções em todo o sistema
- Contratos entre camadas verificados pelo compilador
- Inicialização rápida e pegada pequena, compatíveis com o ambiente

Negativas:

- Trabalho intensivo de CPU bloqueia o event loop. Hoje não há nenhum, mas um relatório pesado futuro
  precisaria sair do processo.
- `any` e casts permitem furar a tipagem. A mitigação é `strict` no `tsconfig` e revisão em PR.
- O Express 4 não trata erro assíncrono nativamente, daí o `errorMiddleware` e o `next(err)` explícito em
  todos os controllers

Risco aceito:

- Concorrência limitada por processo, compensada pelo HorizontalPodAutoscaler, que já é a estratégia
  adotada no ADR-004.

## Quando revisitar

Se aparecer carga intensiva de CPU, ou se um contexto extraído tiver perfil muito diferente
(processamento em lote, por exemplo). Aí vale avaliar outra stack para aquele serviço específico, sem
obrigar o resto a mudar.
