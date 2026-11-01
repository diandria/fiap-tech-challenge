# Checklist de gravação — Fase 4

Documento operacional do dia da gravação. Assume o ambiente **derrubado** e o relógio correndo.

> A subida está no [runbook do ambiente](runbook-ambiente.md). Este checklist começa depois dela, e é o
> que se segue com a câmera prestes a ligar. O vídeo tem **no máximo 15 minutos**: ensaie o roteiro
> inteiro antes e anote os tempos reais na tabela do fim.

## Antes de tudo

- [ ] Ambiente de pé pelo runbook, com a verificação de fumaça inteira passando, inclusive os passos 6 a 8
      (Billing e Execution pelo gateway, a saga andando e o Prometheus coletando os três serviços)
- [ ] Credencial do Learner Lab **renovada há menos de 3 horas** — ela dura ~4h, e expirar no meio
      da gravação quebra tudo que toca a AWS
- [ ] Mercado Pago: a **URL modo teste** do webhook atualizada com o gateway desta sessão (passo 9 do
      runbook), e a conta de teste de comprador já logada numa janela anônima do navegador
- [ ] Postman com o environment da AWS: `baseUrl`, `billingBaseUrl`, `executionBaseUrl` e
      `authBaseUrl` com a URL do gateway, e as pastas 00 a 02 já rodadas
- [ ] Um PR de demonstração preparado em um dos serviços, com uma mudança trivial e visível (um campo
      novo em `/health`, por exemplo), ainda sem merge
- [ ] `BASE_URL` em mãos:

```bash
cd ~/dev/fiap-tech-challenge-infra-k8s && terraform output -raw api_gateway_url
```

## 1. Popular os painéis — ~6 min

**Não pule.** Painel vazio na gravação é indistinguível de painel quebrado, e não dá para descobrir isso
com a câmera ligada.

```bash
cd ~/dev/fiap-tech-challenge
export BASE_URL=$(cd ~/dev/fiap-tech-challenge-infra-k8s && terraform output -raw api_gateway_url)
export ADMIN_PASSWORD=$(aws ssm get-parameter --name /car-repair-shop/app/admin-password \
  --with-decryption --query 'Parameter.Value' --output text)
k6 run scripts/load-test.js
```

Cinco minutos de carga. O cenário de ciclo de OS leva cada ordem pela saga até a cobrança: abertura no
OS, diagnóstico no Execution, orçamento no Billing e aprovação do cliente. Os status depois de
`APPROVED` dependem do pagamento no navegador, então aparecem nos painéis pelas ordens pagas à mão no
ensaio. Os outros cenários alimentam a autenticação de cliente, a rajada para o HPA e os erros
deliberados.

**Espere terminar antes de abrir o Grafana.** O HPA leva ~45s para escalar e ~5 min para voltar ao
mínimo depois que a carga cessa — se quiser mostrar as réplicas altas, grave logo após a carga.

## 2. Conferir os painéis — ~4 min

```bash
kubectl port-forward -n observability svc/kube-prometheus-stack-grafana 3000:80
# usuário e senha:
kubectl get secret grafana-admin -n observability -o jsonpath='{.data.admin-user}' | base64 -d
kubectl get secret grafana-admin -n observability -o jsonpath='{.data.admin-password}' | base64 -d
```

| Painel | O que precisa estar visível |
|---|---|
| Saga da ordem de serviço | respostas aplicadas subindo, backlog do outbox em zero, ao menos uma compensação depois do ensaio |
| Volume de ordens de serviço | contador subindo |
| Tempo até cada status | pontos até `APPROVED` pela carga, e os demais pelas ordens pagas no ensaio |
| Latência, healthchecks e uptime | com o seletor **Serviço** em cada um dos três namespaces |
| Recursos do Kubernetes | CPU e memória por pod, réplicas contra o HPA |

> **Ao mostrar "Tempo até cada status", diga o que ele mede.** A métrica é o tempo desde a abertura
> da OS até cada status, e não o tempo gasto dentro de cada etapa. O tempo de uma etapa é a
> diferença entre as médias de dois status vizinhos.

## 3. Ensaio das falhas — antes de gravar

Rode cada falha uma vez fora da câmera. A primeira execução é a que revela o passo esquecido.

### Pagamento recusado

1. Pasta 03 da coleção até `[Billing] Aguardar a cobranca`.
2. Abra o `checkoutUrl` na janela anônima e pague com um cartão de teste com o titular **`OTHE`**.
3. Confira: a OS em `CANCELLED` (`GET /service-orders/{id}/history` mostra a passagem por `APPROVED`),
   a peça de volta ao estoque (`GET /items/{id}`, `reservedQuantity`), o orçamento `CANCELLED` no
   Billing e a compensação `PAYMENT_FAILED` no painel da saga.

### Execution fora do ar

```bash
kubectl scale deployment/execution-api -n car-repair-shop-execution --replicas=0
```

Abra uma OS pelo Postman. Ela fica em `RECEIVED`, e o `EnqueueDiagnosis` espera na fila:

```bash
Q=$(aws sqs get-queue-url --queue-name car-repair-shop-execution-commands.fifo --query QueueUrl --output text)
aws sqs get-queue-attributes --queue-url "$Q" --attribute-names ApproximateNumberOfMessages
```

```bash
kubectl scale deployment/execution-api -n car-repair-shop-execution --replicas=2
```

Com o Execution de volta, a mensagem é consumida e a OS aparece na fila do mecânico
(`GET /executions/{id}`). Nenhum alerta dispara: mensagem esperando não é falha. O HPA devolve as
réplicas ao mínimo dele sozinho.

### Alerta `SagaMessageFailing`

Uma resposta com tipo desconhecido falha toda vez que o OS a recebe, e o alerta dispara antes de ela ir
para a fila de descarte:

```bash
Q=$(aws sqs get-queue-url --queue-name car-repair-shop-saga-replies.fifo --query QueueUrl --output text)
ID=$(uuidgen | tr 'A-Z' 'a-z')
aws sqs send-message --queue-url "$Q" --message-group-id "ensaio-$ID" --message-deduplication-id "$ID" \
  --message-body "{\"messageId\":\"$ID\",\"type\":\"ShipParts\",\"serviceOrderId\":\"$ID\",\"occurredAt\":\"$(date -u +%FT%TZ)\",\"payload\":{}}"

kubectl port-forward -n observability svc/kube-prometheus-stack-alertmanager 9093:9093
# http://localhost:9093 — SagaMessageFailing com type=ShipParts em ~2 min
```

A mensagem termina na fila de descarte das respostas, que ninguém consome, e não afeta nenhuma ordem.

## 4. Roteiro de 15 minutos

| Tempo | Conteúdo | Requisito |
|---|---|---|
| 0:00–1:30 | Arquitetura pelo diagrama geral: três serviços, três bancos, filas, gateway | R35 |
| 1:30–5:30 | Fluxo completo de uma OS pelo Postman | R39 |
| 5:30–8:30 | Falhas: pagamento recusado e Execution fora do ar | R40 |
| 8:30–11:30 | Deploy de um serviço, do PR ao rollout | R41 |
| 11:30–15:00 | Logs, painel e trace de uma OS pelos três serviços | R42 |

### 0:00–1:30 — Arquitetura

- [ ] `docs/architecture/target-architecture.md`: OS, Billing e Execution, cada um com o próprio banco
      (PostgreSQL, PostgreSQL e DynamoDB), as filas da saga e o gateway como entrada única
- [ ] Uma frase sobre a saga orquestrada pelo OS e por quê (ADR-014)

### 1:30–5:30 — Fluxo completo (R39)

- [ ] Pasta 03: abertura no OS → a ordem aparece na fila do mecânico no **Execution** → diagnóstico →
      orçamento gerado no **Billing** → o cliente aprova com o código
- [ ] Pagamento aprovado no sandbox: `checkoutUrl` na janela anônima, cartão com o titular **`APRO`**
- [ ] Pasta 05: `PAID` → reparo no Execution → `FINISHED` → entrega
- [ ] `GET /service-orders/{id}/history` no **OS**, com todas as etapas

### 5:30–8:30 — Falhas e compensação (R40)

- [ ] Pagamento recusado com **`OTHE`**: a compensação aparece no histórico, no estoque e no painel da saga
- [ ] Execution fora do ar: a mensagem esperando na fila e a saga retomando quando ele volta

### 8:30–11:30 — Deploy de um serviço (R41)

- [ ] O PR preparado: CI com build, lint, testes, cobertura, o job `BDD end-to-end` e, se o SonarQube Cloud
      estiver configurado, a análise
- [ ] Merge na `main` e o CD do serviço: imagem com o SHA, rollout e a verificação depois do deploy
- [ ] A nova versão no ar (o campo novo em `/health`)

### 11:30–15:00 — Rastreamento (R42)

- [ ] Loki: os logs dos três serviços filtrados pelo id da OS, que é o que a coordenação pede para o
      rastreamento:

```logql
{namespace=~"car-repair-shop.*"} |= "<id da OS>"
```

- [ ] O painel da saga: respostas, compensações e backlog
- [ ] O campo **ID da OS** do painel da saga e o trace no Tempo, com spans do OS, da fila e do participante

## 5. Depois de gravar

- [ ] Derrubar o ambiente pela seção "Descida" do runbook
- [ ] Conferir que nada cobrável sobrou — NLB e volumes EBS órfãos são o caso comum

## Tempos

Preencher no ensaio. Os da Fase 3, com um serviço só, foram ~13 min de preparação com o ambiente de pé.

| Etapa | Tempo no ensaio |
|---|---|
| Carga | |
| Conferir painéis | |
| Ensaio das falhas | |
| Roteiro gravado | |
