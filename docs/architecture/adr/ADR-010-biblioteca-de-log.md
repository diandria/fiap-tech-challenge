# ADR-010 (Biblioteca de registro estruturado)

- **Status:** Aceito
- **Data:** 2026-08-28

## Contexto

A aplicação registra eventos com `console.log` em texto livre. Isso precisa virar JSON de uma linha por
evento, com campos consultáveis, ocultação de dados sensíveis e custo baixo o suficiente para ficar
ligado no caminho de toda requisição.

O sistema registra requisições que carregam CPF do cliente, cabeçalho `Authorization` e o segredo
compartilhado do endpoint interno de lookup. Um log de autenticação que vaza CPF é problema real, não
teórico.

## Alternativas

| Alternativa | A favor | Contra |
|---|---|---|
| pino | A mais rápida do ecossistema Node, porque serializa JSON sem formatar no processo. `redact` por caminho como recurso nativo. Formatação legível delegada ao `pino-pretty`, em processo separado. Integração pronta com OpenTelemetry. | Interface mais enxuta que a do winston. Leitura confortável em desenvolvimento exige o `pino-pretty` no caminho. |
| winston | A mais conhecida do ecossistema, com muitos transports prontos e formatação flexível | Bem mais lenta em benchmarks. A formatação síncrona no processo disputa com o atendimento de requisição. Ocultação de campos exige formatter customizado. |
| bunyan | Pioneiro do log JSON em Node, com boa ferramenta de leitura em linha de comando | Manutenção estagnada há anos |
| `console.log` com `JSON.stringify` | Zero dependência | Sem níveis, sem ocultação, sem serializadores. Cada ponto de log vira uma decisão individual de formato, que é exatamente como o log atual chegou onde chegou. |

## Critérios de decisão

Custo por evento no caminho de toda requisição, ocultação de dados sensíveis como recurso de primeira
classe, capacidade de emitir os atributos semânticos do OpenTelemetry definidos no ADR-007, e manutenção
ativa.

## Decisão

`pino`, com o `pino-pretty` restrito ao ambiente de desenvolvimento.

## Por que vence

O primeiro motivo é que o `redact` nativo é requisito, não conforto. Com a lista de campos sensíveis
declarada na configuração do logger, a proteção é central e vale para todo evento. Com um formatter
customizado no winston, ela depende de cada chamada lembrar de omitir o campo, e basta uma esquecer para
o CPF do cliente ir parar no Loki.

O segundo é que custo baixo permite manter ligado. É um evento por requisição, mais os de erro, num
serviço que escala horizontalmente. Registrador caro cria a pressão de reduzir o nível em produção, que é
justamente onde o registro é mais necessário.

O terceiro é que ela sai do caminho da observabilidade. O JSON de uma linha é o que o Promtail interpreta
para promover campos a labels consultáveis no Loki, e a integração com o OpenTelemetry injeta o `trace_id`
sem trabalho manual.

Pensando na decomposição futura, a escolha da biblioteca é local a cada serviço, e nada impede um serviço
futuro usar winston, ou `zap` se for escrito em Go. O que precisa ser comum é o formato, não a
biblioteca: JSON de uma linha, com os atributos semânticos do OpenTelemetry definidos no ADR-007.
Registrar isso explicitamente evita confundir padronização de ferramenta com padronização de contrato.

## Consequências

Positivas:

- `redact` declarado num lugar só, valendo para todo evento
- Custo baixo o suficiente para o registro ficar ligado no caminho quente
- Formato diretamente consumível pelo Promtail e pelo Loki

Negativas:

- O log em desenvolvimento fica ilegível sem o `pino-pretty` no caminho, o que incomoda quem roda
  `npm run dev` sem o script certo
- A API de serializadores do pino tem curva própria, diferente da do winston, que a maioria conhece

Risco aceito:

- A lista de `redact` precisa ser mantida. Um campo sensível novo que não entre nela vaza. Como mitigação,
  há revisão em PR, e a lista fica num arquivo só, fácil de auditar.

## Quando revisitar

Se um caso de uso passar a precisar registrar eventos. Hoje nenhum precisa, e por isso o logger não ganha
um `ILogger` na camada de casos de uso. Enquanto o log acontece só em middlewares e adapters, depender do
pino diretamente é legítimo, e a abstração seria cerimônia sem inversão de dependência.
