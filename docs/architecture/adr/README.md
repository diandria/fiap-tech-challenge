# ADRs

Registros de decisão arquitetural com consequências permanentes.

Um ADR aceito não é editado. Ele é substituído por outro que o marca como `Superseded`. Um ADR editado
apaga o rastro de que a decisão mudou, e o rastro é o que torna o registro útil.

## Regra de redação

Nenhum documento justifica uma decisão dizendo que o projeto pediu, que está no requisito ou que alguém
autorizou. Cada ADR traz no mínimo três alternativas com pontos a favor e contra, os critérios nomeados
antes da conclusão, e as consequências negativas escritas sem suavizar.

| ID | Título | Status | Data |
|---|---|---|---|
| [ADR-001](ADR-001-ponto-unico-de-entrada.md) | Ponto único de entrada | Aceito | 2026-08-28 |
| [ADR-002](ADR-002-function-emissora-de-token.md) | Função serverless como emissora de token | Aceito | 2026-08-28 |
| [ADR-003](ADR-003-padrao-de-comunicacao.md) | Padrão de comunicação híbrido | Aceito | 2026-08-28 |
| [ADR-004](ADR-004-hpa-e-escalabilidade.md) | Escalabilidade horizontal automática | Aceito | 2026-08-28 |
| [ADR-005](ADR-005-observabilidade-self-hosted.md) | Observabilidade auto-hospedada | Aceito | 2026-08-28 |
| [ADR-006](ADR-006-produto-api-gateway.md) | API Gateway gerenciado como implementação | Aceito | 2026-08-28 |
| [ADR-007](ADR-007-telemetria-microsservicos.md) | Telemetria preparada para decomposição | Aceito | 2026-08-28 |
| [ADR-009](ADR-009-stack-da-aplicacao.md) | Stack da aplicação | Aceito | 2026-08-28 |
| [ADR-010](ADR-010-biblioteca-de-log.md) | Biblioteca de registro estruturado | Aceito | 2026-08-28 |

O ADR-008 (escopo da autenticação de cliente) será escrito junto da implementação que o sustenta, no
milestone de autenticação, porque depende do código que protege as rotas.
