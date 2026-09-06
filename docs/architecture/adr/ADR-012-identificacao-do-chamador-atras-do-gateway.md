# ADR-012 (Identificação do chamador atrás do API Gateway)

- **Status:** Aceito
- **Data:** 2026-09-06
- **RFC de origem:** —

## Contexto

O `express-rate-limit` usa `req.ip` como chave. Sem `trust proxy`, o Express devolve
o endereço do socket TCP.

No ambiente implantado, o caminho é API Gateway → VPC Link → NLB interno → pod. O
gateway encerra a conexão HTTP do cliente e abre outra para o NLB, e o target group
está com `preserve_client_ip.enabled = false`. O endereço que chega ao pod é o de uma
das **cinco ENIs gerenciadas pelo API Gateway**, nunca o do chamador.

A consequência foi observada em produção: `10 logins por 15 minutos` deixou de ser um
limite por cliente e virou o teto do sistema inteiro. Quatro execuções da coleção
Postman, que faz três logins cada, bloquearam a autenticação para todos.

O sintoma é pior que o número sugere. O contador é em memória e há várias réplicas,
então o balde é por pod: o bloqueio depende de qual réplica atendeu, e some ao
reiniciar o Deployment. Um limite que se comporta de forma diferente a cada requisição
não protege nem comunica.

O API Gateway já envia o endereço do chamador em `X-Forwarded-For`. Falta o Express
ser autorizado a lê-lo.

## Alternativas

| Alternativa | A favor | Contra |
|---|---|---|
| `trust proxy` com número de saltos | Uma linha; usa o cabeçalho que o gateway já envia; volta a contar por chamador | Confia num cabeçalho, que seria forjável se houvesse caminho paralelo |
| `preserve_client_ip` no target group | IP real no nível TCP, sem confiar em cabeçalho | Não resolve: o gateway já encerrou a conexão, e o IP preservado seria o da ENI dele |
| `keyGenerator` por identidade autenticada | Independe de rede | Não serve para login, que é anterior à autenticação |
| Limite no próprio API Gateway | Fora da aplicação, antes de gastar recurso | O throttling dele é por rota e por stage, não por chamador |
| Store compartilhado (Redis) para o limiter | Contagem consistente entre réplicas | Mais um recurso para provisionar e custear; não resolve a chave errada |

## Decisão

Configurar `app.set('trust proxy', n)` com `n` vindo de `TRUST_PROXY_HOPS`, com valor
`0` por padrão e `1` no ambiente implantado — um salto, correspondente ao API Gateway.
O NLB é camada 4 e não acrescenta salto.

Elevar o teto de login de 10 para 30 por 15 minutos, configurável por
`LOGIN_RATE_LIMIT`. Dez era apertado mesmo por chamador.

## Por que vence

É a única alternativa que corrige a **chave** da contagem. As demais tratam sintomas:
preservar IP no NLB não recupera uma informação que o gateway já descartou, e limitar
no gateway responde a outra pergunta.

O padrão `0` mantém execução local e testes lendo o socket real, sem depender de
cabeçalho que ninguém envia ali.

## Consequências

### Positivas

- O rate limit volta a ser por chamador, que é o que o número sempre pretendeu dizer
- Um cliente abusivo não bloqueia mais os demais
- O comportamento deixa de depender de qual réplica atendeu

### Negativas

- A aplicação passa a confiar num cabeçalho de rede
- Mais duas variáveis de ambiente para manter coerentes entre ambientes

### Riscos aceitos

Confiar em `X-Forwarded-For` só é seguro enquanto o API Gateway for a **única** porta
de entrada, garantida pelo ADR-001, e o NLB permanecer interno. Se algum dia existir
caminho paralelo até os pods, o cabeçalho passa a ser forjável e o limite, burlável
por requisição.

O balde continua em memória e por réplica. Com `n` réplicas, o teto efetivo por
chamador é `n × max` no pior caso. É aceitável para o escopo: o objetivo é conter
abuso grosseiro, não aplicar cota exata.

## Quando revisitar

- Se surgir qualquer caminho de entrada que não passe pelo API Gateway
- Se o limite precisar ser exato, o que exige store compartilhado
- Se o número de saltos mudar, por exemplo com um CDN na frente do gateway
