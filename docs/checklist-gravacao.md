# Checklist de gravação

Documento operacional do dia da gravação. Assume o ambiente **derrubado** e o relógio correndo.

> A subida leva ~38 min e está no [runbook do ambiente](runbook-ambiente.md). Este checklist começa
> depois dela, e é o que se segue com a câmera prestes a ligar.

## Antes de tudo

- [ ] Ambiente de pé pelo runbook, com a verificação de fumaça inteira passando
- [ ] Credencial do Learner Lab **renovada há menos de 3 horas** — ela dura ~4h, e expirar no meio
      da gravação quebra tudo que toca a AWS
- [ ] `BASE_URL` em mãos:

```bash
cd ~/dev/fiap-tech-challenge-infra-k8s && terraform output -raw api_gateway_url
```

## 1. Popular os painéis — ~6 min

**Não pule.** Dashboard vazio na gravação é indistinguível de dashboard quebrado, e não dá para
descobrir isso com a câmera ligada.

```bash
cd ~/dev/fiap-tech-challenge
export BASE_URL=$(cd ~/dev/fiap-tech-challenge-infra-k8s && terraform output -raw api_gateway_url)
export ADMIN_PASSWORD=$(aws ssm get-parameter --name /car-repair-shop/app/admin-password \
  --with-decryption --query 'Parameter.Value' --output text)
k6 run scripts/load-test.js
```

Cinco minutos de carga. Os quatro cenários alimentam painéis diferentes: ciclo de OS, autenticação
de cliente, rajada para o HPA e erros deliberados.

**Espere terminar antes de abrir o Grafana.** O HPA leva ~45s para escalar e ~5 min para voltar ao
mínimo depois que a carga cessa — se quiser mostrar as réplicas altas, grave logo após a carga.

## 2. Conferir os cinco dashboards — ~4 min

```bash
kubectl port-forward -n observability svc/kube-prometheus-stack-grafana 3000:80
# usuário e senha:
kubectl get secret grafana-admin -n observability -o jsonpath='{.data.admin-user}' | base64 -d
kubectl get secret grafana-admin -n observability -o jsonpath='{.data.admin-password}' | base64 -d
```

| Dashboard | O que precisa estar visível | Valor medido em 31/08 |
|---|---|---|
| Volume de ordens de serviço | contador subindo | ~155 OS em 15 min |
| Tempo até cada status | ponto em **todos** os status | 6 status, ~30 cada |
| Latência, healthchecks e uptime | p95, uptime 100%, taxa de erro | p95 49 ms, uptime 100% |
| Recursos do Kubernetes | CPU/memória por pod, réplicas | pico de 10 réplicas, CPU 79% |
| Alertas | ao menos um disparável | ver passo 3 |

> Se a **taxa de erro** aparecer como `No data` em vez de `0%`, o dashboard está desatualizado —
> foi corrigido no infra-k8s#23.

## 3. Disparar um alerta ao vivo — ~3 min

O alerta com disparo mais confiável é o `ServiceOrderProcessingFailures`, porque a falha é forçada
sem derrubar nada:

```bash
# 1. aponta o tópico SNS para um ARN inexistente
ARN=$(kubectl get cm car-repair-shop-runtime -n car-repair-shop -o jsonpath='{.data.SNS_TOPIC_ARN}')
echo "$ARN"   # ANOTE, é o que você vai restaurar
kubectl patch cm car-repair-shop-runtime -n car-repair-shop --type merge \
  -p '{"data":{"SNS_TOPIC_ARN":"arn:aws:sns:us-east-1:000000000000:nao-existe"}}'
kubectl rollout restart deployment/car-repair-shop-api -n car-repair-shop
kubectl rollout status deployment/car-repair-shop-api -n car-repair-shop --timeout=240s
```

**Espere o rollout terminar de verdade antes de gerar as falhas.** Um contador com labels não emite
série até a primeira incrementação — se os pods forem substituídos depois de falharem, a série
desaparece e o alerta volta a `inactive`. Foi o que aconteceu na primeira tentativa deste ensaio.

```bash
# 2. gera transições de status; cada uma tenta notificar e falha
#    (10 a 14 chamadas, para cair nos dois pods)

# 3. o alerta sobe: pending -> firing em ~63s
kubectl port-forward -n observability svc/kube-prometheus-stack-alertmanager 9093:9093
# http://localhost:9093
```

```bash
# 4. RESTAURE — não esqueça
kubectl patch cm car-repair-shop-runtime -n car-repair-shop --type merge \
  -p "{\"data\":{\"SNS_TOPIC_ARN\":\"$ARN\"}}"
kubectl rollout restart deployment/car-repair-shop-api -n car-repair-shop
```

## 4. Roteiro do que mostrar

- [ ] **Entrada única** — `/health` pelo API Gateway; o NLB é interno e não tem caminho público
- [ ] **Autenticação por CPF** — `POST /auth/cpf` atravessa gateway, function e lookup na aplicação
- [ ] **Ciclo de OS** — do `RECEIVED` ao `DELIVERED`; a aprovação é do **cliente**, com código de
      confirmação (os 4 primeiros dígitos do CPF)
- [ ] **Notificação assíncrona** — mudança de status publica no SNS e a Lambda entrega
- [ ] **Rastro cruzando a fronteira** — o mesmo `trace_id` nos logs da aplicação e da function
- [ ] **Escalabilidade** — o painel de réplicas subindo sob carga
- [ ] **Alerta** — `firing` no Alertmanager
- [ ] **Rollback** — ver "Provar o rollback" no runbook; o deploy falha **sem indisponibilidade**
- [ ] **Status por e-mail** — ator externo chama o `PATCH` e o e-mail sai pela function

## 5. Depois de gravar

- [ ] Derrubar o ambiente pela seção "Descida" do runbook
- [ ] Conferir que nada cobrável sobrou — NLB e volumes EBS órfãos são o caso comum

## Tempos

| Etapa | Tempo |
|---|---|
| Carga | ~5 min |
| Conferir dashboards | ~4 min |
| Disparar alerta e restaurar | ~4 min |
| **Preparação total, com o ambiente já de pé** | **~13 min** |

Somando a subida do runbook: **~51 minutos** do zero até poder gravar.
