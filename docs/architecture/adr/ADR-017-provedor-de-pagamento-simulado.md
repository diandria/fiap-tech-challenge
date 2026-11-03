# ADR-017 (Provedor de pagamento simulado como serviço)

- **Status:** Aceito
- **Data:** 2026-11-03
- **RFC de origem:** RFC-006 (integração de pagamento com o Mercado Pago)

## Contexto

A RFC-006 definiu como o Billing cobra o orçamento aprovado: token por `client_credentials`, preferência
do Checkout Pro, cliente pagando no link, notificação assinada com `x-signature` e consulta do pagamento
pela API. O código desse caminho existe no Billing, mas nunca rodou contra o Mercado Pago. A página que
gera as credenciais de teste retorna erro, e sem credencial não há token.

O ambiente usava o gateway simulado que a própria RFC-006 previa, dentro do Billing. Ele resolvia o
pagamento sem nenhuma das partes que tornam a integração difícil: não havia token, nem aviso assinado,
nem consulta ao provedor. O cliente "pagava" chamando uma rota do próprio Billing, com o token de
administrador. Metade do contrato com o provedor nunca era exercitada, e o lojista decidia sozinho se
tinha recebido.

A pergunta é como cobrar de um jeito que exercite o fluxo inteiro de um provedor externo sem depender do
Mercado Pago.

## Alternativas

| Alternativa | A favor | Contra |
|---|---|---|
| Mercado Pago real, no ambiente de testes dele | Integração verdadeira; nada para manter do nosso lado. | Sem credencial de teste não existe. Mesmo com ela, a URL do webhook muda a cada subida do ambiente e precisa ser recadastrada à mão no painel, e três pontos do contrato ainda estão sem confirmação (RFC-006). |
| Gateway simulado dentro do Billing (o que existia) | Nenhuma infraestrutura a mais. | Não há token, nem aviso, nem consulta: o adaptador do Mercado Pago fica sem uso. O lojista decide o próprio pagamento, e o código de produção carrega uma rota que só existe para teste. |
| Serviço separado, com contrato próprio e simples | Serviço pequeno, com as rotas que quisermos. | O Billing precisaria de um segundo adaptador, que não vale para o Mercado Pago. Voltar ao provedor real seria reescrever a integração. |
| Serviço separado, com o contrato do Mercado Pago | O Billing usa o adaptador que já existe, só com outra URL. Token, preferência, aviso assinado e consulta passam a rodar de ponta a ponta. O provedor fica fora do lojista, como na vida real. | Um serviço a mais para implantar e acompanhar. O contrato cobre só o pedaço que o Billing usa, e acertar a imitação não prova que o Mercado Pago responde igual. |

Critérios, nesta ordem: exercitar o fluxo inteiro de um provedor externo, com autenticação própria e aviso
assinado; não manter código só de teste no Billing; voltar ao Mercado Pago sem reescrever nada; e ser o
mais simples possível de manter.

## Decisão

O pagamento passa pelo **Payment Service**, um serviço novo no repositório `fiap-tech-challenge-payment`,
que implementa o contrato do Mercado Pago no pedaço que o Billing usa:

- `POST /oauth/token` com `client_credentials`, devolvendo um token com validade e `live_mode: false`;
- `POST /checkout/preferences` e `GET /v1/payments/{id}`, só com esse token;
- `GET /checkout/{id}` e `POST /checkout/{id}/pay`, o lado do cliente, publicados no API Gateway;
- o aviso ao Billing em `notification_url`, com `x-signature` calculado do mesmo jeito que o Mercado Pago.

O Billing aponta `MERCADO_PAGO_API_URL` para o endereço interno do serviço no cluster. As credenciais do
Billing no provedor e o segredo do aviso são gerados pelo Terraform do `infra-k8s` e lidos pelos CDs dos
dois serviços. O gateway simulado dentro do Billing é removido.

O serviço guarda tudo em memória e roda com uma réplica.

## Por que vence

É a única alternativa que cumpre os quatro critérios ao mesmo tempo. O Mercado Pago real seria o ideal,
mas não existe sem credencial. O simulado interno não exercita token nem aviso. O serviço com contrato
próprio exercita o fluxo, mas joga fora o adaptador e torna a volta ao provedor real uma reescrita. Com o
contrato do Mercado Pago, o código de integração que nunca tinha rodado passa a ser testado no compose de
ponta a ponta e no ambiente, e trocar pelo provedor real é trocar a URL e as credenciais.

## Consequências

### Positivas

- O adaptador do Mercado Pago no Billing roda de verdade: troca de credenciais por token, cobrança com o
  token, conferência da assinatura e consulta do pagamento.
- O cliente paga num link que não é do Billing, e o Billing só confirma o pagamento depois de consultar o
  provedor, como faria com o Mercado Pago.
- O Billing não carrega mais nenhuma rota ou classe que só existe para teste.
- As credenciais nunca são copiadas à mão: um Terraform gera, dois CDs leem.

### Negativas

- Um serviço a mais: repositório, pipeline, imagem, namespace e NLB.
- O estado em memória obriga uma réplica. Reiniciar o pod perde as cobranças abertas, e a ordem precisa de
  uma nova cobrança.
- A imitação cobre só o que o Billing usa. Comportamentos do Mercado Pago fora desse pedaço, como
  estornos, pagamento pendente ou reenvio do aviso por horas, não são simulados.

### Riscos aceitos

- O contrato imitado pode divergir do real nos três pontos que a RFC-006 deixou sem confirmação. Só um
  teste no sandbox do Mercado Pago resolve isso.

## Quando revisitar

- Se houver credencial de teste do Mercado Pago: apontar `MERCADO_PAGO_API_URL` para o Mercado Pago,
  confirmar os três pontos da RFC-006 e decidir se o Payment Service continua só para o compose local.
- Se o serviço precisar de mais de uma réplica: guardar cobranças e pagamentos num banco.
