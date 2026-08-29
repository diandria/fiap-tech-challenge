# ADR-007 (Telemetria preparada para decomposição)

- **Status:** Aceito
- **Data:** 2026-08-28

## Contexto

A aplicação é hoje um monolito modular, e a intenção declarada é decompô-la em serviços menores mais
adiante. A instrumentação de logs (pino), métricas (`prom-client`) e traces (OpenTelemetry) está sendo
construída agora.

Convenções escolhidas neste momento ou sobrevivem à decomposição, ou viram um retrabalho que atinge todos
os serviços de uma vez. Telemetria só tem valor quando é comparável entre eles.

A decomposição, aliás, já começou. A Lambda de notificações é o primeiro contexto extraído do processo
principal, e serve de teste real das convenções decididas aqui.

## Contextos delimitados identificados

Mapa provável da decomposição, derivado da estrutura atual da camada de casos de uso:

| Contexto | Situação |
|---|---|
| Ordens de serviço | O núcleo, e o último a sair, se sair |
| Cadastro de clientes e veículos | Coeso, com poucas dependências de entrada |
| Catálogo e estoque | A reserva de estoque é o acoplamento a resolver |
| Identidade | Já parcialmente fora, com a Lambda de emissão de token |
| Notificações | Já extraído |

Não é compromisso de plano. É o mapa que justifica as convenções abaixo.

## Alternativas

| Alternativa | A favor | Contra |
|---|---|---|
| Nomes e campos decididos caso a caso | Nenhum custo de aprendizado, escreve-se o que for mais direto | Cada serviço novo inventa os próprios nomes. Consultas e painéis precisam ser reescritos a cada extração. |
| Convenção própria, com um header `x-correlation-id` documentado internamente | Adaptada exatamente ao que este sistema precisa, e mais legível ao depurar com `curl` | Precisa ser ensinada a cada pessoa e a cada serviço novo. Nenhuma biblioteca a propaga sozinha. |
| Convenções semânticas do OpenTelemetry, com `traceparent` do W3C Trace Context | Qualquer SDK do OpenTelemetry propaga sozinho, em qualquer linguagem. Um serviço novo emite telemetria comparável sem combinar nada. | Nomes mais verbosos. Exige disciplina para não inventar campo paralelo quando der preguiça. |

## Decisão

Convenções semânticas do OpenTelemetry, com seis regras.

A primeira: identidade de serviço em atributo, nunca no nome da métrica. Vale
`http_request_duration_seconds` com o atributo `service.name`, e nunca
`oficina_app_http_request_duration_seconds`. Nome de métrica com o serviço embutido impede somar latência
entre serviços e obriga a reescrever dashboard a cada extração.

A segunda: atributos de recurso nas convenções semânticas do OpenTelemetry, ou seja `service.name`,
`service.version` e `deployment.environment`. Não inventar `app`, `env` ou `versao`.

A terceira: o `traceparent` do W3C Trace Context é a correlação primária, não um `x-correlation-id`
próprio. Esta é a que mais economiza retrabalho. Um header caseiro funciona dentro de um processo e morre
na primeira fronteira de serviço, porque nenhuma biblioteca o propaga sozinha. O `traceparent` é
propagado automaticamente por qualquer SDK do OpenTelemetry, sobre HTTP e sobre mensageria.

A quarta: todo log carrega `trace_id` e `span_id`. É o que permite pular de um log no Loki para o trace no
Tempo, e depois da decomposição atravessar serviços nesse pulo.

A quinta: métricas de negócio nomeadas pelo contexto, não pelo serviço. `service_orders_created_total`
continua válido quando ordens de serviço virar serviço próprio. `app_orders_created_total` vira mentira no
mesmo dia.

A sexta: o `traceparent` atravessa a mensageria. O evento publicado no SNS carrega o campo, e a Lambda
consumidora continua o mesmo trace. Sem isso, o salto assíncrono corta o rastro exatamente onde ele é mais
difícil de reconstruir à mão.

## Por que vence

O `x-correlation-id` próprio é a armadilha. Parece equivalente ao `traceparent`, é mais legível ao depurar
com `curl`, mas exige que cada chamada entre serviços lembre de repassá-lo. Basta um esquecimento para o
rastro sumir, e o sintoma é a ausência de informação, que ninguém percebe até precisar dela.

## Consequências

Positivas:

- Extrair um contexto para serviço próprio não exige tocar em dashboard, alerta ou consulta LogQL. Muda o
  valor de `service.name` e aparece uma série nova.
- Instrumentação em OpenMetrics e OTLP, portável entre backends de observabilidade
- Um serviço futuro em Go ou Java entra na mesma stack sem adaptação

Negativas:

- O `traceparent` é menos legível que um UUID em header próprio ao depurar com `curl`. Como mitigação, o
  log expõe o `trace_id` isolado, que é a metade que interessa.
- As convenções do OpenTelemetry são mais verbosas que nomes improvisados, e exigem disciplina para não
  criar campo paralelo

Risco aceito:

- O custo é pago agora e o benefício só se realiza se a decomposição acontecer. Se ela nunca vier, o que
  sobra é telemetria em OpenTelemetry, portável e padronizada, que não é desperdício.

## Quando revisitar

Se o projeto decidir formalmente que a decomposição não vai acontecer, vale reavaliar só a sexta regra, a
propagação do `traceparent` pelo SNS, que é a de maior custo de implementação. As outras cinco continuam
se pagando num sistema único.
