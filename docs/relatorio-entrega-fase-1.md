# Entrega — FIAP Tech Challenge — Fase 1

**Nome do Grupo:** Diandria Xavier (individual)
**Participantes:** Diandria Xavier — RM370738 — Discord: `diandriaxavier`

**Link da documentação DDD (Miro):** <https://miro.com/app/board/uXjVGxm4qWA=/?share_link_id=127189069797>
**Link do repositório:** <https://github.com/diandria/fiap-tech-challenge>

---

## Resumo da Arquitetura

Monolito hexagonal (ports & adapters) em Node.js + TypeScript + Express, persistindo em MongoDB via Mongoose. As camadas de domínio e aplicação não conhecem framework; a infraestrutura (HTTP, persistência, notificação, Swagger) é acoplada por interfaces (ports), o que torna os adapters trocáveis sem impactar o núcleo.

**Núcleo do domínio:** a Ordem de Serviço (OS) é o agregado central, governado por uma máquina de estados auditável (`RECEIVED → DIAGNOSIS → WAITING_APPROVAL → APPROVED → EXECUTION → FINISHED → DELIVERED`, com `REJECTED` como estado terminal). A aprovação pelo cliente acontece em endpoint público, autenticada por um código de 4 dígitos derivado dos primeiros dígitos do CPF/CNPJ — sem necessidade de cadastro do cliente final. O estoque trabalha com dois campos (`stockQuantity` e `reservedQuantity`): a reserva acontece quando o item entra na OS, e o consumo (decremento real do estoque) acontece na transição para `EXECUTION`.

**Stack de qualidade:** Jest + ts-jest + Supertest + `mongodb-memory-server` (sem infra externa para os testes). Cobertura ≥ 80% (atual: 93%). Análise estática via SonarQube Community Edition local em Docker, com o scanner também executado via container — sem dependência de Java no host.

**Segurança aplicada:** JWT stateless (24h), bcrypt com 12 rounds para senhas, `helmet` com CSP customizada compatível com Swagger UI, rate limiting em endpoints sensíveis (login: 10 req/15 min por IP; aprovação pública: 5 req/h por IP+OS), validação de CPF/CNPJ pelos dígitos verificadores (mod 11), CORS por allowlist configurável via env.

**Documento de Arquitetura completo (DAS):** <https://github.com/diandria/fiap-tech-challenge/blob/main/docs/architecture.md>

---

## Relatório de Análise de Vulnerabilidades

### Ferramentas utilizadas

- **SonarQube Community Edition 10**, executado localmente via Docker sob o profile `sonar` do `docker-compose.yml`.
- **`sonarsource/sonar-scanner-cli`** (Docker) para o scanner — sem necessidade de Java no host.
- **`npm audit`** para análise de vulnerabilidades nas dependências do ecossistema npm.

### Resultado consolidado

| Dimensão | Resultado |
|---|---|
| Bugs (SonarQube) | 0 |
| Vulnerabilities (SonarQube) | 0 |
| Code Smells (SonarQube) | Resolvidos os apontamentos (detalhes em "Achados") |
| Security Hotspots (SonarQube) | Revisados e tratados (detalhes em "Achados") |
| Cobertura de testes | ~93% (lines) — acima do mínimo de 80% definido pelo projeto |
| Vulnerabilidades em dependências (`npm audit`) | 0 vulnerabilidades em 597 pacotes auditados (143 prod + 453 dev + 1 peer) |

### Achados e tratativas

#### 1. Security Hotspot — `helmet({ contentSecurityPolicy: false })`

**Origem.** O `src/app.ts` desabilitava por completo a Content Security Policy do `helmet`, removendo uma camada importante de defesa contra ataques de Cross-Site Scripting (XSS) na superfície HTTP da aplicação.

**Tratativa.** A configuração foi substituída por uma CSP customizada que **mantém os defaults restritivos do helmet** (`default-src 'self'`, `frame-ancestors 'self'`, `object-src 'none'`, entre outros) e relaxa **apenas** a diretiva necessária para o Swagger UI continuar funcionando: `script-src ['self', 'unsafe-inline']`. O Swagger UI depende de scripts inline para inicializar a interface em `/docs`.

**Status atual.** O hotspot original foi resolvido. A introdução do `'unsafe-inline'` gera um hotspot residual conhecido, marcado como **Safe** no SonarQube com a justificativa *"required by Swagger UI inline scripts in /docs"*. O risco residual é mitigado pelo fato de o endpoint `/docs` servir conteúdo estático embarcado pela biblioteca `swagger-ui-express`, sem interação com input externo do usuário.

#### 2. Code Smells — uso de `||` para fallback de variáveis de ambiente

**Origem.** Três ocorrências de `||` para fallback de variáveis de ambiente:
- `src/main.ts:6` — `process.env.PORT || 3000`
- `src/main.ts:7` — `process.env.MONGODB_URI || 'mongodb://...'`
- `src/app.ts:20` — `(process.env.CORS_ORIGIN || '').split(',')`

A regra do SonarQube recomenda o operador `??` (nullish coalescing), por ser mais explícito sobre o que conta como "ausência de valor" — evitando comportamento inesperado em strings vazias ou valores `0`/`false`.

**Tratativa.** As três ocorrências foram trocadas para `??`. Como `process.env.X` é sempre `string | undefined`, o comportamento permanece idêntico em runtime, mas o código fica semanticamente correto e alinhado às boas práticas atuais do TypeScript.

**Status atual.** Resolvido.

#### 3. Vulnerabilidades em dependências (`npm audit`)

**Análise.** Executado `npm audit` sobre as 597 dependências do projeto (143 de produção + 453 de dev + 1 peer + 3 opcionais).

**Resultado.** **Zero vulnerabilidades** em todos os níveis de severidade (info, low, moderate, high, critical).

### Controles de segurança aplicados (defesa em profundidade)

Para além da remoção dos achados acima, a aplicação aplica controles em múltiplas camadas:

| Camada | Controle |
|---|---|
| Transporte | CORS por allowlist configurável (`CORS_ORIGIN`) |
| Headers HTTP | `helmet` com CSP customizada |
| Autenticação | JWT stateless com expiração de 24h, segredo via env (`JWT_SECRET`) |
| Armazenamento de senhas | Hash bcrypt com 12 rounds; senhas nunca retornadas em responses |
| Autorização | RBAC com 3 papéis (`attendant`, `mechanic`, `admin`); middleware `requireRole` aplicado por endpoint |
| Mitigação de brute force | Rate limit em `POST /auth/login` (10 req/15 min por IP) e em `PATCH /service-orders/:id/budget` (5 req/h por combinação IP + OS) |
| Validação de entrada | Validação de CPF (11 dígitos + mod 11) e CNPJ (14 dígitos + mod 11); placa em formatos antigo (`ABC-1234`) e Mercosul (`ABC1D23`) |
| Prevenção de injeção | Queries parametrizadas via Mongoose; sem interpolação de string em queries |
| Privacidade | CPF/CNPJ armazenados somente como dígitos; nunca devolvidos nas responses de OS |
| Histórico | Soft delete em clientes (`deletedAt`), preservando o histórico de OSs vinculadas |

### Evidência (dashboard SonarQube)

> _[colar aqui o print do dashboard `http://localhost:9000/dashboard?id=car-repair-shop-api` mostrando Reliability A, Security A, Maintainability A, Coverage ≥ 80%, 0 Bugs, 0 Vulnerabilities, Hotspots revisados]_
