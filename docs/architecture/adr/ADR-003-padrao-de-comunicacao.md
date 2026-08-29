# ADR-003 (Padrão de comunicação híbrido)

- **Status:** Aceito
- **Data:** 2026-08-28

## Contexto

O sistema tem interações com naturezas diferentes. Forçar um único padrão em todas custa caro dos dois
lados: síncrono onde não precisa acopla no tempo, e assíncrono onde precisa de resposta obriga a inventar
consulta periódica.

Hoje as notificações rodam dentro do processo da aplicação, e os casos de uso engolem a exceção quando a
entrega falha. O comportamento está certo, porque uma falha de e-mail não deve reverter uma transição de
status. O custo é que a falha fica invisível e também irrecuperável.

## Alternativas

Para a notificação, que é onde a decisão importa:

| Alternativa | A favor | Contra |
|---|---|---|
| Manter no processo da aplicação | Zero infraestrutura, nada a provisionar | Notificação perdida é perdida para sempre. O envio disputa CPU com o atendimento de requisições. Escala junto com a API, mesmo tendo carga completamente diferente. |
| A aplicação invoca a Lambda diretamente, pelo SDK | Separa o processamento, e é simples | A aplicação espera a invocação. Falha derruba o fluxo ou volta ao `catch {}`. Sem retry. |
| Publicar num tópico SNS | Retry e dead-letter queue de graça. A aplicação não espera. Notificação e API escalam de forma independente. | Dois modelos de erro. Evento perdido só aparece na DLQ, não na resposta. Entrega "pelo menos uma vez". |

## Decisão

Dois padrões, cada um onde faz sentido:

| Interação | Padrão | Por quê |
|---|---|---|
| Cliente ou funcionário para a API | Síncrono | O chamador precisa da resposta para continuar |
| Lambda de autenticação para a aplicação | Síncrono, HTTP | O token só existe depois da consulta |
| Aplicação para notificações | Assíncrono, via SNS | O cliente não espera o e-mail para ver a ordem mudar de status |

## Por que vence

O SNS preserva a propriedade boa do modelo atual (a transição não depende do e-mail) e elimina a ruim,
porque a entrega passa a ter retry e uma dead-letter queue no SQS para onde o que falhou vai. É a única
das três que consegue as duas coisas ao mesmo tempo.

Pensando na decomposição futura, o tópico SNS também é a costura por onde os contextos se separam. Um
evento publicado sem saber quem escuta permite que outros contextos assinem o mesmo tópico sem que o
publicador seja modificado. É essa propriedade que torna a decomposição incremental em vez de uma virada
única.

A escolha se paga hoje pelo retry e pela dead-letter queue. A extensibilidade vem junto.

## Contrato do evento

Consumido pela Lambda de notificações e pelo `SnsNotificationService` da aplicação, que vivem em
repositórios diferentes. Precisa ser preciso o bastante para que os dois lados sejam construídos por
pessoas diferentes.

```json
{
  "eventType": "SERVICE_ORDER_STATUS_CHANGED" | "BUDGET_READY",
  "occurredAt": "2026-08-28T20:00:00.000Z",
  "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  "serviceOrder": { "id": "...", "status": "WAITING_APPROVAL", "budgetTotal": 1234.56 },
  "customer": { "id": "...", "name": "...", "email": "..." }
}
```

O evento carrega os dados que a notificação precisa. A Lambda não consulta o RDS, pelo mesmo raciocínio do
ADR-002: ela tem uma responsabilidade, que é formatar e entregar a mensagem.

O campo `traceparent` não é enfeite. O salto assíncrono é onde o rastro normalmente se perde, porque a
requisição termina, a publicação retorna, e o processamento acontece depois, noutro processo. Carregando o
contexto no evento, a Lambda cria seus spans como filhos do mesmo trace, e a jornada aparece inteira no
Tempo, do clique do atendente até o e-mail saindo. Sem isso, sobram dois traces desconexos e a
reconstrução vira comparação manual de horário.

## Consequências

Positivas:

- A aplicação não espera o envio
- A entrega ganha retry do SNS e dead-letter queue no SQS
- Notificação e API escalam e são implantadas de forma independente

Negativas:

- Dois modelos mentais de erro
- Um evento publicado e não processado só aparece na dead-letter queue, não na resposta da requisição
- O `traceparent` precisa atravessar o tópico para o rastreio continuar funcionando, e por isso está no
  contrato

Risco aceito:

- O SNS entrega "pelo menos uma vez", então uma notificação duplicada é possível. Para e-mail de mudança
  de status, isso é incômodo, não incorreto. Não vai haver deduplicação.

## Quando revisitar

Se aparecer uma notificação cuja duplicação seja inaceitável, como uma cobrança. Aí o modelo de entrega
precisa mudar (SQS FIFO, por exemplo), e a deduplicação deixa de ser dispensável.
