# RFC-006 (Integração de pagamento com o Mercado Pago)

- **Status:** Aceita
- **Data:** 2026-10-31

## Contexto

O Billing precisa cobrar o orçamento aprovado antes de a ordem seguir para a execução (ADR-014), e o
provedor é o Mercado Pago. A cobrança é uma etapa da saga: o resultado dela decide se a ordem segue para o
reparo ou se tudo o que foi feito até ali é desfeito.

Três coisas tornam essa integração diferente de uma chamada de API comum:

- **O resultado chega depois, e por outro caminho.** O cliente paga no tempo dele, e o provedor avisa por
  notificação. O Billing não pode ficar esperando a resposta de uma chamada.
- **A notificação é uma porta pública.** Qualquer um que descubra a rota pode chamá-la dizendo que um
  pagamento foi aprovado.
- **A notificação pode chegar repetida.** O provedor reenvia até receber confirmação, e uma ordem não pode
  ser liberada duas vezes, nem com valor diferente do orçamento.

Também importa o quanto de dado sensível passa pelo Billing: quanto menos dado de cartão o serviço tocar,
menor a superfície de risco.

## Alternativas avaliadas

### Checkout Pro (preferência e link de pagamento)

A favor: o Billing cria uma preferência com o valor e a referência da ordem, e recebe um link. O cliente paga
na página do Mercado Pago, que cuida de cartão, Pix e boleto; o Billing nunca vê dado de pagamento. Não exige
cadastro prévio de loja nem de caixa. O ambiente de testes tem usuários e cartões que aprovam ou recusam
conforme o nome do titular, o que torna a recusa reproduzível.

Contra: o cliente sai do fluxo da oficina para pagar. A confirmação depende da notificação chegar, e o
endereço de notificação precisa ser público.

### Checkout API (pagamento direto pela API, com cartão ou Pix)

A favor: o pagamento acontece sem sair da aplicação, e o resultado do cartão volta na própria chamada.

Contra: o Billing passa a receber dados de cartão tokenizados e precisa de um formulário próprio para
coletá-los. Para Pix, o resultado continua chegando por notificação, sem ganho em relação ao Checkout Pro.
Mais código e mais responsabilidade sobre dado sensível.

### QR Code (order presencial)

A favor: experiência de balcão, natural para uma oficina: o atendente mostra o código e o cliente paga pelo
celular.

Contra: a order de QR Code precisa apontar para um caixa já cadastrado, e o caixa para uma loja. Sem esse
cadastro, a criação falha com `pos_not_found`. Num ambiente recriado a cada sessão, é um passo manual a mais
toda vez.

### Só um gateway simulado

A favor: nenhuma dependência externa, testes determinísticos, nenhuma credencial.

Contra: não integra com o provedor. Serve como modo de teste, não como integração.

## Critérios de decisão

- **Dado sensível no Billing:** quanto menos, melhor.
- **Cadastro prévio** necessário antes da primeira cobrança.
- **Testabilidade da recusa:** a falha precisa ser reproduzível sem depender de um cartão real.
- **Segurança da notificação:** como provar que quem chamou é o provedor, e que o pagamento existe.
- **Esforço de implementação.**

## Recomendação

**Checkout Pro**, com um **modo simulado** atrás do mesmo contrato.

### Autenticação

O Billing obtém o token de acesso com as credenciais da aplicação (`client_id` e `client_secret`), pelo fluxo
`client_credentials` em `POST https://api.mercadopago.com/oauth/token`, e guarda o token até perto do
vencimento informado em `expires_in`. Nenhum token fixo copiado do painel fica na configuração.

### Fluxo

1. O OS envia `RequestPayment` (ADR-015).
2. O Billing cria a preferência com o total do orçamento, `external_reference` igual ao id da ordem e
   `notification_url` apontando para `POST /payments/notifications`, publicada no API Gateway.
3. O link vai para o cliente por e-mail (`PAYMENT_REQUESTED`) e fica disponível na consulta do orçamento.
4. O cliente paga; o Mercado Pago chama a notificação.
5. O Billing valida a assinatura, consulta o pagamento na API pelo id recebido, e decide pelo que a consulta
   devolveu. O corpo da notificação nunca decide nada.
6. O resultado vira `PaymentConfirmed` ou `PaymentFailed` para o OS, pelo outbox.

### Validação da notificação

Conforme a documentação de notificações do Mercado Pago:

- O cabeçalho `x-signature` traz `ts` e `v1`, separados por vírgula.
- O manifesto é `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, com o `data.id` lido da query string. Um
  par ausente na notificação é omitido do manifesto, e um `data.id` alfanumérico vai em minúsculas.
- O `v1` é o HMAC-SHA256, em hexadecimal, do manifesto com a chave secreta da notificação.
- A comparação é feita em tempo constante, e assinatura inválida recebe `401`.

### Decisão pelo status consultado

| Status consultado | Resultado |
|---|---|
| `approved` | `PaymentConfirmed`, se o valor pago for igual ao total do orçamento |
| `approved` com valor diferente | `PaymentFailed`, motivo `AMOUNT_MISMATCH` |
| `rejected`, `cancelled` | `PaymentFailed` |
| `pending`, `in_process`, `authorized` | Nada; aguarda a próxima notificação |

A primeira recusa encerra a cobrança e dispara a compensação da saga (ADR-014). O cliente não tenta outro
cartão na mesma ordem.

### Idempotência

O id do pagamento no provedor é único na tabela de pagamentos. Uma notificação repetida encontra o
pagamento já resolvido e não gera uma segunda resposta para o OS. Duas notificações simultâneas resultam numa
confirmação e num conflito, tratado como "já processado".

### Modo simulado

Com `PAYMENT_PROVIDER=mock`, o Billing usa um gateway simulado que implementa o mesmo contrato. A decisão de
aprovar ou recusar é tomada por uma rota restrita a administradores, que passa pelo mesmo caminho de
confirmação da notificação real. Ele existe para o teste de ponta a ponta com os três serviços e como
alternativa caso o ambiente de testes do provedor esteja indisponível. A rota simulada não existe no modo
`mercado-pago` e não é publicada no API Gateway.

### Segredos

`client_id`, `client_secret` e a chave da notificação ficam no armazenamento de parâmetros como
`SecureString`, em `/car-repair-shop/billing/mercado-pago-client-id`,
`/car-repair-shop/billing/mercado-pago-client-secret` e
`/car-repair-shop/billing/mercado-pago-webhook-secret`. São cadastrados pelo roteiro do ambiente, nunca em
arquivo de variáveis do Terraform.

### Testes

No ambiente de testes do provedor, com usuários de teste de vendedor e de comprador: cartão de teste com
titular `APRO` aprova, e com titular `OTHE` recusa.

## Consequências

Positivas:

- O Billing não manipula dado de cartão
- A recusa é reproduzível, e a saga pode ser demonstrada nos dois caminhos
- A notificação forjada é recusada pela assinatura, e uma notificação verdadeira só confirma o que a consulta
  à API confirma
- O modo simulado deixa o fluxo completo testável sem dependência externa

Negativas:

- O cliente sai da aplicação para pagar
- A confirmação depende de a notificação alcançar o API Gateway; se o endereço mudar a cada recriação do
  ambiente, ele precisa ser atualizado
- Duas implementações do mesmo contrato para manter (real e simulada)

Riscos aceitos:

- Sem nova tentativa depois de uma recusa, um cliente que errou o cartão precisa de uma ordem nova
- O fluxo `client_credentials` precisa ser aceito pela aplicação cadastrada no provedor; se não for, a
  autenticação volta para o token da aplicação, guardado como segredo
