# Runbook — ambiente efêmero

Documento operacional. O ambiente é recriado do zero a cada sessão do Learner Lab, e este é o
procedimento para subir, verificar e derrubar os três serviços da Fase 4 (OS, Billing e Execution) e a
plataforma que eles dividem.

**Escrito para ser seguido sob pressão**, com o ambiente derrubado e tempo contado.

> **Não comece a provisionar meia hora antes de gravar.** A subida completa leva cerca de
> **40 minutos**, e a maior parte é espera de recurso da AWS, que não acelera.

## Tempos medidos

| Etapa | Tempo |
|---|---|
| `infra-db` (VPC + RDS) | ~7 min |
| Banco do Billing (RDS) e tabelas do Execution (DynamoDB) | a cronometrar |
| `infra-k8s` — primeira fase (EKS + addons + observabilidade + filas) | ~22 min |
| Services dos três serviços (nascem os NLBs) | ~3 min medidos com um; a cronometrar com três |
| `lambda` (duas functions + tópico) | ~2 min |
| Credenciais do Mercado Pago no SSM | a cronometrar |
| `infra-k8s` — segunda fase (integração e rotas do gateway) | ~1 min |
| Deploy dos serviços (build, push, migration, rollout) | ~3 min medidos no OS; Billing e Execution a cronometrar |
| Verificação de fumaça | a cronometrar |

**Os tempos com valor foram cronometrados num ciclo completo do zero em 31/08/2026**, com um serviço
só. As etapas novas da Fase 4 ficam como "a cronometrar" até a primeira subida completa: não são
estimativa. O banco do Billing não depende do `infra-db` e pode subir junto com ele, e os três deploys
rodam em paralelo.

---

## Subida

### 0. Só numa conta nova do Learner Lab

Quando a faculdade troca a conta do lab, o bucket de estado do Terraform não existe na conta nova. Crie
o bucket como descreve o README do `infra-db` (seção "Bucket de estado"), e confira que o `backend.tf`
dos cinco repositórios com Terraform (`infra-db`, `infra-k8s`, `lambda`, `terraform/` do Billing e
`terraform/` do Execution) aponta para `fiap-tech-challenge-tfstate-<id da conta>`. Os parâmetros do
SSM e as credenciais do Mercado Pago também são da conta: o passo 9 cadastra de novo.

### 1. Todos os repositórios na `main`

**Antes de qualquer apply.** Aplicar de uma branch de PR sobe a versão que aquela branch tinha
quando nasceu, não a atual.

```bash
for r in fiap-tech-challenge fiap-tech-challenge-lambda \
         fiap-tech-challenge-infra-k8s fiap-tech-challenge-infra-db \
         fiap-tech-challenge-billing fiap-tech-challenge-execution; do
  git -C ~/dev/$r checkout main && git -C ~/dev/$r pull
done
```

> Isto já custou uma sessão: o repositório de lambda estava numa branch criada antes do merge da
> propagação de trace. As notificações chegavam normalmente, e o log da function saía **sem
> `trace_id`** — o rastro atravessando a fronteira assíncrona, que é o ponto da demonstração,
> simplesmente não existia. Nada no ambiente indicava erro.

### 2. Credenciais

No Learner Lab: **Start Lab** → aguarde o círculo verde → **AWS Details** → **AWS CLI** → **Show**.
Cole o bloco em `~/.aws/credentials`.

```bash
aws ec2 describe-vpcs --max-items 1 >/dev/null && echo "credencial ok"
```

> Use uma chamada que **toca recurso**, e não `sts get-caller-identity`: o Learner Lab revoga a
> sessão mantendo o `get-caller-identity` respondendo. A diferença aparece vinte minutos adiante,
> com uma mensagem que não aponta para a causa.

### 3. Publicar as credenciais em todos os repositórios

```bash
~/dev/fiap-tech-challenge-lambda/scripts/refresh-aws-secrets.sh --all
```

Sem isso, o CD falha ao tocar a AWS. O `--all` publica nos seis repositórios da lista do script. Uma
opção desconhecida faz o script parar com erro, sem publicar nada.

> Este passo já dizia `--todos`. O script não conhecia a opção, publicava só no repositório atual e
> terminava sem erro, e os outros ficavam com a credencial vencida.

### 4. `infra-db` — VPC e banco (~7 min)

```bash
cd ~/dev/fiap-tech-challenge-infra-db
terraform init -input=false && terraform apply -auto-approve
```

Cria a VPC, o RDS e os parâmetros no SSM: senha do banco e **senha do admin da aplicação**.

### 5. Banco do Billing e tabelas do Execution

Cada serviço novo tem o próprio `terraform/`, com estado próprio. Nenhum lê o estado de outro repositório,
então os dois podem rodar enquanto o `infra-db` sobe:

```bash
cd ~/dev/fiap-tech-challenge-billing
terraform -chdir=terraform init -input=false && terraform -chdir=terraform apply -auto-approve

cd ~/dev/fiap-tech-challenge-execution
terraform -chdir=terraform init -input=false && terraform -chdir=terraform apply -auto-approve
```

O Billing ganha o RDS `car-repair-shop-billing-db` e a senha em `/car-repair-shop/billing/db/password`.
O Execution ganha as três tabelas do DynamoDB. O CD do Execution confere que as três estão `ACTIVE`
antes do rollout; o do Billing lê o endereço do banco direto do RDS.

### 6. `infra-k8s` — primeira fase, sem as rotas do gateway (~22 min)

**O `infra-k8s` é aplicado em duas fases**, e entre elas entram os Services dos três serviços, o lambda e
as credenciais do Mercado Pago.
Não é preciosismo: há duas dependências que só se resolvem nessa ordem.

- a integração do gateway precisa do ARN do listener do **NLB** de cada serviço, e cada NLB nasce do
  Service daquele serviço, que mora no repositório do código (`k8s/02-service/`)
- a rota `POST /auth/cpf` precisa do **ARN da function**, que só existe depois do apply do lambda
- e o lambda precisa do `api_gateway_url`, que sai desta primeira fase

A variável `enable_gateway_routes` desliga, nesta fase, tudo o que depende do NLB e da function:

```bash
cd ~/dev/fiap-tech-challenge-infra-k8s
terraform init -input=false && terraform apply -auto-approve -var enable_gateway_routes=false
```

> Com a variável em `false`, `data.aws_lb` nem entra no plano. Ela existe porque esse data source
> **falha no plano**, e não apenas no apply, quando o NLB não existe; deixá-lo e esperar que o
> Terraform adie não funciona. Antes da variável, o procedimento era mover três arquivos `.tf` para
> fora do diretório e devolvê-los depois, e esquecê-los fora fazia o apply seguinte destruir as
> rotas.

> Se o apply falhar no meio, **não interrompa um novo apply pela metade**. Aplies interrompidos
> deixam inconsistência de três camadas (estado do Terraform, release do Helm e o Secret que guarda
> o release), e reconciliar isso leva mais tempo que deixar terminar.

Esta fase também cria o que os três serviços dividem: as filas da saga (`billing-commands`,
`execution-commands` e `saga-replies`, cada uma com a fila de descarte), um registro no ECR e um
namespace por serviço.

**Este passo não vale só pelo `Apply complete!`.** Confira que a observabilidade subiu de verdade:

```bash
kubectl get pods -n observability
```

Os onze pods precisam estar `Running`. O `tempo-0` é o que costuma cair, em `CrashLoopBackOff` por
`OOMKilled` — e quando ele cai a aplicação continua exportando spans para um coletor inexistente,
**sem nenhum erro no log**. Tudo parece certo e a aba de traces do Grafana fica vazia.

### 7. Services dos três serviços — nascem os NLBs

```bash
aws eks update-kubeconfig --name car-repair-shop --region us-east-1
kubectl apply -f ~/dev/fiap-tech-challenge/k8s/02-service/
kubectl apply -f ~/dev/fiap-tech-challenge-billing/k8s/02-service/
kubectl apply -f ~/dev/fiap-tech-challenge-execution/k8s/02-service/
```

O AWS Load Balancer Controller cria um NLB interno para cada Service, a partir das anotações. **Espere
os três ficarem prontos** antes de seguir — a fase 2 procura cada balanceador por tag e falha se algum
ainda não existir:

```bash
aws elbv2 describe-load-balancers \
  --query "LoadBalancers[?State.Code=='active'].[LoadBalancerName,State.Code]" --output text
```

> O CD também aplica este diretório, junto do resto. Aqui ele é aplicado à mão só porque a fase 2
> do `infra-k8s` precisa do NLB **antes** de o gateway ter rota para o cluster — e sem rota o
> smoke check do CD falharia.

### 8. `lambda` — functions e tópico (~2 min)

```bash
cd ~/dev/fiap-tech-challenge-lambda
(cd functions/auth && npm ci && npm run build)
(cd functions/notifications && npm ci && npm run build)
terraform -chdir=terraform init -input=false && terraform -chdir=terraform apply -auto-approve
```

Gera `JWT_SECRET` e `INTERNAL_TOKEN` no SSM. A aplicação lê **os mesmos parâmetros** — não há duas
cópias para divergir.

### 9. Credenciais do Mercado Pago no SSM

O Billing lê `client_id`, `client_secret` e a assinatura secreta do webhook no SSM, cadastrados à mão
para nunca passarem por `tfvars` nem pelo estado do Terraform. Sem os três, o CD do Billing para na
leitura da configuração, com `required value missing or empty`.

1. Pegue a URL do gateway, que existe desde a primeira fase:

   ```bash
   cd ~/dev/fiap-tech-challenge-infra-k8s && terraform output -raw api_gateway_url
   ```

2. No painel do Mercado Pago, na aplicação de teste, em **Webhooks > Configurar notificações**, preencha
   a **URL modo teste** com `<url do gateway>/payments/notifications` e salve. **O endereço muda a cada
   recriação do ambiente**, então este passo se repete a cada sessão.
3. Cadastre os três valores. O passo a passo da aplicação de teste e das contas de teste está no README
   do Billing:

   ```bash
   aws ssm put-parameter --overwrite --type SecureString --name /car-repair-shop/billing/mercado-pago-client-id --value '<client id>'
   aws ssm put-parameter --overwrite --type SecureString --name /car-repair-shop/billing/mercado-pago-client-secret --value '<client secret>'
   aws ssm put-parameter --overwrite --type SecureString --name /car-repair-shop/billing/mercado-pago-webhook-secret --value '<assinatura secreta>'
   ```

### 10. `infra-k8s` — segunda fase, integração e rotas (~1 min)

Agora existem o NLB e os outputs do lambda:

```bash
cd ~/dev/fiap-tech-challenge-infra-k8s
terraform apply -auto-approve
```

Sem `-var`, a variável volta ao padrão `true` e o apply cria as integrações dos três serviços, as
rotas e a permissão da function. As rotas do orçamento e do pagamento vão para o Billing, `/executions`
vai para o Execution, e o resto continua no OS. É o mesmo apply que o CD executa num merge na `main`.

Confirme que as rotas existem antes de seguir:

```bash
aws apigatewayv2 get-routes --api-id $(terraform output -raw api_gateway_id) \
  --query "Items[].RouteKey" --output text
```

> **Nunca aplique com `enable_gateway_routes=false` num ambiente que já tem as rotas.** O apply
> destrói integração e rotas, e o gateway passa a responder 404 em tudo. A variável só existe para a
> primeira fase de uma subida do zero.

### 11. Os três serviços

Merge na `main` dispara o CD de cada repositório. Para forçar sem um commit novo, **reexecute o último
CI da `main`** de cada um — o CD escuta o evento `workflow_run` do CI:

```bash
for r in fiap-tech-challenge fiap-tech-challenge-billing fiap-tech-challenge-execution; do
  gh run rerun -R diandria/$r $(gh run list -R diandria/$r --workflow CI --branch main --limit 1 \
    --json databaseId --jq '.[0].databaseId')
done
```

> `gh workflow run CI --ref main` **não funciona**: o CI só tem gatilho de `push` e `pull_request`,
> e a chamada devolve `HTTP 422: Workflow does not have 'workflow_dispatch' trigger`.

Cada CD constrói a imagem, publica no ECR do serviço, lê a configuração no SSM e na AWS, aplica
`k8s/01-config/`, `k8s/02-service/` e `k8s/03-app/`, roda a migration como Job (OS e Billing), faz `set
image` e verifica o rollout — com rollback se falhar. O do OS confere `/health` pelo gateway; os do Billing
e do Execution conferem `/ready` dentro do pod, porque no gateway o `/health` é do OS.

Os três podem subir em qualquer ordem: uma ordem aberta antes de o Execution estar no ar fica em
`RECEIVED`, com o `EnqueueDiagnosis` esperando na fila, e anda assim que ele sobe.

---

## Verificação de fumaça

Rode **todos** os passos. Cada um cobre uma fronteira diferente.

```bash
GW=$(cd ~/dev/fiap-tech-challenge-infra-k8s && terraform output -raw api_gateway_url)

# 1. A aplicação responde pelo gateway
curl -s "$GW/health"    # {"status":"ok"}
curl -s "$GW/ready"     # {"status":"ready","checks":{"database":"up"}}
```

```bash
# 2. O admin foi semeado e autentica
ADMIN=$(aws ssm get-parameter --name /car-repair-shop/app/admin-password \
  --with-decryption --query 'Parameter.Value' --output text)
TOKEN=$(curl -s -X POST "$GW/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"admin@master.com\",\"password\":\"$ADMIN\"}" | jq -r .token)
[ -n "$TOKEN" ] && echo "login ok"
```

```bash
# 3. Autenticação de cliente por CPF — atravessa gateway, function e aplicação
curl -s -X POST "$GW/customers" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"name":"Ana","taxId":"529.982.247-25","taxType":"CPF","email":"a@t.com","phone":"11999999999"}'

curl -s -X POST "$GW/auth/cpf" -H 'content-type: application/json' \
  -d '{"cpf":"52998224725"}'   # deve devolver { "token": ... }
```

> Se este passo devolver `401 authentication failed` com um CPF cadastrado, **não é credencial**:
> é a function não alcançando `POST /auth/customers/lookup`. Confira se a rota existe no gateway
> (`aws apigatewayv2 get-routes --api-id <id>`).

```bash
# 4. O rastro atravessa a fronteira assíncrona
#    Depois do passo 7, quando a saga muda o status da OS e o cliente é
#    avisado, confirme o mesmo trace_id dos dois lados:
kubectl logs -n car-repair-shop -l app=car-repair-shop-api --tail=100 | grep trace_id
aws logs filter-log-events --log-group-name /aws/lambda/car-repair-shop-notifications \
  --start-time $(( ($(date +%s) - 600) * 1000 )) --filter-pattern '"notificacao entregue"'
```

```bash
# 5. Observabilidade com dados
#    Antes do Grafana, confirme que o coletor esta de pe -- um Tempo caido nao
#    produz erro em lugar nenhum, so um painel vazio.
kubectl get pods -n observability | grep -v Running   # so o cabecalho deve sobrar

kubectl port-forward -n observability svc/tempo 3200:3200 &
curl -s localhost:3200/ready                          # ready
curl -s localhost:3200/metrics | grep tempo_distributor_spans_received_total

kubectl port-forward -n observability svc/kube-prometheus-stack-grafana 3000:80
```

No Grafana, confira as três fontes, e não só que a página abre:

| Fonte | O que precisa aparecer |
|---|---|
| Loki | logs da aplicação com `trace_id`, e os da function de notificações |
| Tempo | um trace da aplicação, buscado pelo `trace_id` de um dos logs |
| Prometheus | as métricas de negócio e o histograma de latência HTTP |

O contador de spans precisa estar **subindo** entre duas leituras. Um Tempo que responde `ready` mas
não recebe span nenhum é o mesmo painel vazio, com aparência de saúde.

### Billing, Execution e a saga

```bash
# 6. Billing e Execution respondem pelo gateway. O 401 vem do serviço; um 404
#    seria o gateway sem a rota, ou seja, a segunda fase do infra-k8s faltando.
curl -s -o /dev/null -w '%{http_code}\n' "$GW/executions"                        # 401
curl -s -o /dev/null -w '%{http_code}\n' \
  "$GW/service-orders/00000000-0000-0000-0000-000000000000/budget"               # 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$GW/payments/notifications"    # 401, sem assinatura
kubectl get pods -n car-repair-shop-billing      # 2/2 prontos
kubectl get pods -n car-repair-shop-execution    # 2/2 prontos
```

```bash
# 7. A saga anda: uma OS aberta no OS aparece na fila do mecânico no Execution.
#    Usa o TOKEN do passo 2 e o cliente do passo 3.
CUSTOMER=$(curl -s "$GW/customers/tax/52998224725" -H "authorization: Bearer $TOKEN" | jq -r .id)
VEHICLE=$(curl -s -X POST "$GW/vehicles" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d "{\"customerId\":\"$CUSTOMER\",\"plate\":\"ABC1D23\",\"brand\":\"Fiat\",\"model\":\"Uno\",\"year\":2018}" | jq -r .id)
OS=$(curl -s -X POST "$GW/service-orders" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d "{\"customerId\":\"$CUSTOMER\",\"vehicleId\":\"$VEHICLE\"}" | jq -r .id)
sleep 5
curl -s "$GW/executions/$OS" -H "authorization: Bearer $TOKEN"   # "stage":"DIAGNOSIS","status":"QUEUED"
```

Se a OS não aparecer no Execution, olhe nesta ordem: o log do OS (`outbox publishing failed` indica fila
inacessível), a fila `car-repair-shop-execution-commands.fifo` no console do SQS e o log do Execution. O
fluxo completo, com orçamento, pagamento e reparo, está nas pastas 03 a 05 da coleção do Postman.

```bash
# 8. O Prometheus coleta os três serviços, e o painel da saga tem dados
kubectl port-forward -n observability svc/kube-prometheus-stack-prometheus 9090:9090 &
curl -s 'localhost:9090/api/v1/query' --data-urlencode 'query=up{namespace=~"car-repair-shop.*"}' \
  | jq -r '.data.result[] | "\(.metric.namespace) \(.value[1])"'   # três namespaces com 1
```

No Grafana, o painel **Oficina — Saga da ordem de serviço** precisa mostrar a resposta `DiagnosisStarted`
depois do passo 7. A tabela de traces do painel, com o id da OS no campo **ID da OS**, mostra um trace com
spans do OS e do Execution.

---

## Provar o rollback

O CD desfaz o deploy sozinho quando o rollout falha, e termina **vermelho** — um rollback que
funciona mas deixa o workflow verde é pior que não ter rollback, porque ninguém fica sabendo.

Para demonstrar sem quebrar nada de verdade, aponte o Deployment para uma tag que não existe:

```bash
NS=car-repair-shop; D=deployment/car-repair-shop-api

kubectl set image $D api=<registry>/car-repair-shop:naoexiste -n $NS
kubectl rollout status $D -n $NS --timeout=90s     # error: timed out ... (exit 1)
kubectl get pods -n $NS -l app=car-repair-shop-api # pod novo em ErrImagePull

kubectl rollout undo $D -n $NS
kubectl rollout status $D -n $NS --timeout=180s    # successfully rolled out
```

**Verificado em 31/08/2026.** O ponto que vale mostrar: durante a falha, os **pods antigos continuam
`1/1 Running` e servindo tráfego**. O rolling update segura a réplica quebrada em `ErrImagePull` e
não retira as saudáveis — o deploy falha sem indisponibilidade. O `/health` responde 200 o tempo
todo, inclusive no meio do rollout falho.

O `rollout status` **falhar por timeout, e não ficar pendurado**, é o que dispara o
`if: failure() && steps.rollout.outcome == 'failure'` do `cd.yml`.

---

## Descida

**Ordem inversa da subida.** Não pule etapas: derrubar a VPC antes do cluster deixa recursos órfãos
que continuam faturando.

```bash
# 1. Os três serviços, Services incluídos. Cada Service tem de sair antes do
#    cluster: é ele que possui o NLB, e o `terraform destroy` do infra-k8s não o
#    conhece mais.
for r in fiap-tech-challenge fiap-tech-challenge-billing fiap-tech-challenge-execution; do
  kubectl delete -f ~/dev/$r/k8s/03-app/ -f ~/dev/$r/k8s/02-service/ --ignore-not-found
done

# 2. Lambda
cd ~/dev/fiap-tech-challenge-lambda && terraform -chdir=terraform destroy -auto-approve

# 3. Cluster, gateway e filas
cd ~/dev/fiap-tech-challenge-infra-k8s && terraform destroy -auto-approve

# 4. Banco do Billing e tabelas do Execution
cd ~/dev/fiap-tech-challenge-billing && terraform -chdir=terraform destroy -auto-approve
cd ~/dev/fiap-tech-challenge-execution && terraform -chdir=terraform destroy -auto-approve

# 5. Banco e VPC
cd ~/dev/fiap-tech-challenge-infra-db && terraform destroy -auto-approve
```

Os workflows `Infra destroy` do Billing e do Execution fazem o passo 4 pelo GitHub, digitando
`production` para confirmar.

### Confirmar que nada cobrável sobrou

O `destroy` do Terraform não pega o que ele não criou. **NLB e volumes EBS órfãos são o caso comum**,
e continuam faturando depois que o cluster some.

```bash
~/dev/fiap-tech-challenge-infra-db/scripts/status.sh
```

Ou manualmente:

```bash
aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerName'
aws ec2 describe-volumes --filters Name=status,Values=available --query 'Volumes[].VolumeId'
aws ec2 describe-addresses --query 'Addresses[].AllocationId'
aws rds describe-db-instances --query 'DBInstances[].DBInstanceIdentifier'
aws dynamodb list-tables --query 'TableNames'
aws sqs list-queues --query 'QueueUrls'
```

Todas devem voltar vazias.

> **Não interrompa um teardown pela metade.** Uma descida interrompida deixa o release do Helm
> registrado no estado do Terraform mas ausente do cluster, e o apply seguinte falha com
> `has no deployed releases`. Reconciliar exige `terraform state rm` e apagar o Secret
> `sh.helm.release.v1.*`, que nem aparece em `helm list`.

---

## Quando as credenciais expiram no meio do trabalho

A sessão do Learner Lab dura cerca de 4 horas. O sintoma varia e raramente aponta para a causa:

| Sintoma | Onde aparece |
|---|---|
| `ExpiredToken` | CLI da AWS |
| `Unable to access object ... in S3` | `terraform init` ou `plan` |
| Workflow falhando no primeiro passo que toca a AWS | GitHub Actions |

O que fazer:

1. **Start Lab** novamente e copie as credenciais novas para `~/.aws/credentials`
2. Rode `refresh-aws-secrets.sh --all` de novo — os secrets do GitHub têm a credencial **antiga**
3. Se um `terraform apply` foi interrompido pela expiração, rode `terraform plan` antes de reaplicar:
   o estado pode ter recursos criados mas não registrados

> Renovar a credencial local **não** renova os secrets do GitHub. Esquecer o passo 2 é a causa mais
> comum de "funciona no meu terminal e falha no CI".
