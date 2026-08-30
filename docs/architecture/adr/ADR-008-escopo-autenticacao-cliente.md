# ADR-008 (Escopo da autenticação de cliente)

- **Status:** Aceito
- **Data:** 2026-08-30
- **RFC de origem:** RFC-003
- **Relacionado:** [ADR-002](ADR-002-function-emissora-de-token.md)

## Contexto

Duas rotas nasceram públicas na Fase 2 porque não havia como autenticar cliente: `GET
/service-orders/{id}/status` e `PATCH /service-orders/{id}/budget`. A proteção era o código de
confirmação — os primeiros dígitos do CPF — mais rate limit.

Com a function emissora de token (ADR-002), passa a existir identidade de cliente. A pergunta é o
que fazer com essas rotas, e onde verificar que a OS consultada é de fato de quem pergunta.

Um dado importa: o código de confirmação **não é segredo**. São os quatro primeiros dígitos de um
CPF, e quem conhece o cliente os conhece. Ele sempre foi confirmação de intenção, nunca prova de
identidade.

## Alternativas

| Alternativa | A favor | Contra |
|---|---|---|
| Manter as rotas públicas, só com o código | Nada muda; o link da notificação continua funcionando sem login | O código não é segredo, e o ID da OS é adivinhável por quem tem um. Continua sendo possível decidir o orçamento de outra pessoa |
| Autenticar, e verificar a titularidade **no middleware** | Uma barreira só, antes de qualquer caso de uso | O middleware não sabe de quem é a OS sem consultar o repositório. Se consultar, a camada de frameworks passa a fazer trabalho de caso de uso — e a regra fica para trás quando o contexto for extraído |
| Autenticar no middleware, verificar a titularidade **no caso de uso** | Autenticação e autorização em camadas próprias; a regra de negócio viaja com o contexto numa extração futura | Cada caso de uso precisa receber `requesterCustomerId`, e cada rota precisa preenchê-lo a partir do token |

## Decisão

As duas rotas passam a exigir token de cliente (`authMiddleware` + `requireCustomer`). A
titularidade é verificada **dentro do caso de uso**, via `assertOwnership`, antes de qualquer
escrita.

O código de confirmação **permanece**. O rate limit **permanece**.

`GET /services` deixa de ser pública no mesmo movimento.

## Por que vence

O critério que decide é **onde a regra continua valendo quando o código se move**.

Titularidade é regra de negócio: "um cliente só decide sobre a própria OS" é uma afirmação sobre a
oficina, não sobre HTTP. Colocá-la no middleware a prenderia à camada de transporte. Quando o
contexto de ordens de serviço virar serviço próprio, a regra viaja junto com o caso de uso; se
morasse no gateway, ficaria para trás, e o serviço novo nasceria confiando que alguém antes dele
validou — que é exatamente como se constrói um sistema onde ninguém valida.

**Autenticar não é autorizar, e as duas são necessárias.** O token prova *quem* a pessoa é. A
titularidade prova que ela pode agir *sobre aquele recurso*. Sem a segunda, qualquer cliente
autenticado decidiria o orçamento de qualquer outro — e o sistema pareceria seguro, porque exigiria
login.

**Por que o código de confirmação fica**, mesmo redundante para identificar: ele responde outra
pergunta. O token diz quem está agindo; o código diz que a pessoa teve a intenção de aprovar
*aquele* orçamento, e não clicou por engano. Custa uma linha e evita a aprovação acidental.

**Por que o rate limit fica:** rate limit e autenticação resolvem problemas diferentes. Autenticação
barra quem não deveria entrar; rate limit barra quem entrou e está abusando.

**403 e não 404 para o não-dono.** 404 esconderia a existência do recurso e evitaria enumeração; 403
comunica o que aconteceu. Aqui o cliente já está autenticado e o ID da OS chegou até ele por
notificação, então não há oráculo a proteger — e 403 é a resposta honesta. As duas posições se
sustentam; o que não se sustentaria é não ter decidido.

## O critério das rotas que continuam públicas

Uma rota só permanece sem `authMiddleware` se cair em **uma destas quatro** categorias:

1. **Autenticação** — precisa ser alcançável por quem ainda não tem token (`POST /auth/login`,
   `POST /auth/cpf` no gateway)
2. **Health check** — consumida pelo kubelet, que não carrega credencial (`GET /health`,
   `GET /ready`)
3. **Documentação** — o Swagger descreve o contrato, não expõe dado (`GET /docs`)
4. **Webhook** — chamada por terceiro que autentica por outro mecanismo (assinatura no corpo).
   Nenhuma existe hoje; a categoria fica registrada para não ser inventada caso a caso

O critério existe para que **rotas futuras se classifiquem sozinhas**, em vez de a lista precisar ser
renegociada a cada uma.

`GET /services` não se encaixa em nenhuma das quatro. O catálogo carrega preços, que são informação
de negócio, e a rota estava pública por herança da Fase 2, com `security: []` explícito na anotação.
Passa a exigir token de funcionário.

`GET /metrics` é exceção deliberada e **não** entra na lista: o Prometheus raspa de dentro do
cluster, sem credencial, e a rota não é exposta no API Gateway.

## Consequências

Positivas:

- O cliente só enxerga e decide sobre a própria OS, e há teste provando que o efeito colateral não
  acontece quando não é dono
- A regra de titularidade é testável sem HTTP e acompanha o contexto numa extração futura
- Nenhuma rota de negócio permanece pública por herança

Negativas:

- O link direto da notificação deixa de funcionar sem login: o cliente precisa autenticar por CPF
  antes de aprovar o orçamento. É um passo a mais no fluxo mais sensível do sistema
- Cada caso de uso de cliente carrega um parâmetro a mais
- `JWT_SECRET` precisa bater entre a aplicação e a function. Divergência causa 401 sem mensagem útil

Riscos aceitos:

- O JWT de cliente não é revogável antes de expirar. Um token vazado vale até o `exp`. Proporcional
  ao escopo, dado que a expiração é curta

## Quando revisitar

Se aparecer um ator que não seja nem funcionário nem cliente — uma oficina parceira, uma
seguradora — a união discriminada por `type` ganha uma variante e um middleware novo, sem abrir os
existentes. Se a titularidade passar a depender de mais que `customerId` (um cliente com procurador,
por exemplo), a regra deixa de ser uma comparação e vira política própria.
