# Runbook — ambiente efêmero

Documento operacional. O ambiente é recriado do zero a cada sessão do Learner Lab, e este é o
procedimento para subir, verificar e derrubar.

**Escrito para ser seguido sob pressão**, com o ambiente derrubado e tempo contado.

> **Não comece a provisionar meia hora antes de gravar.** A subida completa leva cerca de
> **40 minutos**, e a maior parte é espera de recurso da AWS, que não acelera.

## Tempos medidos

| Etapa | Tempo |
|---|---|
| `infra-db` (VPC + RDS) | ~7 min |
| `infra-k8s` — primeira fase (EKS + addons + observabilidade) | ~22 min |
| Service da aplicação (nasce o NLB) | ~3 min |
| `lambda` (duas functions + tópico) | ~2 min |
| `infra-k8s` — segunda fase (integração e rotas do gateway) | ~1 min |
| Deploy da aplicação (build, push, migration, rollout) | ~3 min |
| Verificação de fumaça | ~3 min |
| **Total** | **~41 min** |

**Todos os tempos foram cronometrados num ciclo completo do zero em 31/08/2026.** Não são
estimativa.

---

## Subida

### 1. Todos os repositórios na `main`

**Antes de qualquer apply.** Aplicar de uma branch de PR sobe a versão que aquela branch tinha
quando nasceu, não a atual.

```bash
for r in fiap-tech-challenge fiap-tech-challenge-lambda \
         fiap-tech-challenge-infra-k8s fiap-tech-challenge-infra-db; do
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

### 3. Publicar as credenciais nos quatro repositórios

```bash
~/dev/fiap-tech-challenge-lambda/scripts/refresh-aws-secrets.sh --todos
```

Sem isso, o CD falha ao tocar a AWS.

### 4. `infra-db` — VPC e banco (~7 min)

```bash
cd ~/dev/fiap-tech-challenge-infra-db
terraform init -input=false && terraform apply -auto-approve
```

Cria a VPC, o RDS e os parâmetros no SSM: senha do banco e **senha do admin da aplicação**.

### 5. `infra-k8s` — primeira fase, sem as rotas do gateway (~22 min)

**O `infra-k8s` é aplicado em duas fases**, e entre elas entram o Service da aplicação e o lambda.
Não é preciosismo: há duas dependências que só se resolvem nessa ordem.

- a integração do gateway precisa do ARN do listener do **NLB**, e o NLB nasce do Service da
  aplicação, que mora no repositório do código (`k8s/02-service/`)
- a rota `POST /auth/cpf` precisa do **ARN da function**, que só existe depois do apply do lambda
- e o lambda precisa do `api_gateway_url`, que sai desta primeira fase

Três arquivos saem do caminho nesta fase:

```bash
cd ~/dev/fiap-tech-challenge-infra-k8s
mkdir -p /tmp/fase2
mv api-gateway-routes.tf api-gateway-lookup-route.tf api-gateway-auth-route.tf /tmp/fase2/
terraform init -input=false && terraform apply -auto-approve
```

> `api-gateway-routes.tf` contém `data.aws_lb`, que **falha no plano**, e não apenas no apply,
> quando o NLB não existe. Não adianta deixá-lo e esperar que o Terraform adie.

> Se o apply falhar no meio, **não interrompa um novo apply pela metade**. Aplies interrompidos
> deixam inconsistência de três camadas (estado do Terraform, release do Helm e o Secret que guarda
> o release), e reconciliar isso leva mais tempo que deixar terminar.

**Este passo não vale só pelo `Apply complete!`.** Confira que a observabilidade subiu de verdade:

```bash
kubectl get pods -n observability
```

Os onze pods precisam estar `Running`. O `tempo-0` é o que costuma cair, em `CrashLoopBackOff` por
`OOMKilled` — e quando ele cai a aplicação continua exportando spans para um coletor inexistente,
**sem nenhum erro no log**. Tudo parece certo e a aba de traces do Grafana fica vazia.

### 6. Service da aplicação — nasce o NLB (~3 min)

```bash
aws eks update-kubeconfig --name car-repair-shop --region us-east-1
kubectl apply -f ~/dev/fiap-tech-challenge/k8s/02-service/
```

O AWS Load Balancer Controller cria o NLB interno a partir das anotações do Service. **Espere ele
ficar pronto** antes de seguir — a fase 2 procura o balanceador por tag e falha se ele ainda não
existir:

```bash
aws elbv2 describe-load-balancers \
  --query "LoadBalancers[?State.Code=='active'].[LoadBalancerName,State.Code]" --output text
```

> O CD também aplica este diretório, junto do resto. Aqui ele é aplicado à mão só porque a fase 2
> do `infra-k8s` precisa do NLB **antes** de o gateway ter rota para o cluster — e sem rota o
> smoke check do CD falharia.

### 7. `lambda` — functions e tópico (~2 min)

```bash
cd ~/dev/fiap-tech-challenge-lambda
(cd functions/auth && npm ci && npm run build)
(cd functions/notifications && npm ci && npm run build)
terraform -chdir=terraform init -input=false && terraform -chdir=terraform apply -auto-approve
```

Gera `JWT_SECRET` e `INTERNAL_TOKEN` no SSM. A aplicação lê **os mesmos parâmetros** — não há duas
cópias para divergir.

### 8. `infra-k8s` — segunda fase, integração e rotas (~1 min)

Agora existem o NLB e os outputs do lambda:

```bash
cd ~/dev/fiap-tech-challenge-infra-k8s
mv /tmp/fase2/*.tf .
terraform apply -auto-approve
```

Confirme que as rotas existem antes de seguir:

```bash
aws apigatewayv2 get-routes --api-id $(terraform output -raw api_gateway_id) \
  --query "Items[].RouteKey" --output text
```

> **Devolva os arquivos mesmo se algo falhar entre as duas fases.** Esquecê-los fora do lugar faz o
> apply seguinte destruir integração e rotas, e o gateway passa a responder 404 em tudo.

### 9. Aplicação (~3 min)

Merge na `main` dispara o CD. Para forçar sem um commit novo, **reexecute o último CI da `main`** —
o CD escuta o evento `workflow_run` do CI:

```bash
cd ~/dev/fiap-tech-challenge
gh run rerun $(gh run list --workflow CI --branch main --limit 1 --json databaseId \
  --jq '.[0].databaseId')
```

> `gh workflow run CI --ref main` **não funciona**: o CI só tem gatilho de `push` e `pull_request`,
> e a chamada devolve `HTTP 422: Workflow does not have 'workflow_dispatch' trigger`.

O CD constrói a imagem, publica no ECR, aplica `k8s/01-config/`, `k8s/02-service/` e `k8s/03-app/`,
roda a migration como Job, faz `set image` e verifica o rollout — com rollback se falhar.

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
#    Mude o status de uma OS e confirme o mesmo trace_id dos dois lados:
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
# 1. Aplicação, Service incluído. O Service tem de sair antes do cluster: é ele
#    que possui o NLB, e o `terraform destroy` do infra-k8s não o conhece mais.
kubectl delete -f ~/dev/fiap-tech-challenge/k8s/03-app/ \
                -f ~/dev/fiap-tech-challenge/k8s/02-service/ --ignore-not-found

# 2. Lambda
cd ~/dev/fiap-tech-challenge-lambda && terraform -chdir=terraform destroy -auto-approve

# 3. Cluster e gateway
cd ~/dev/fiap-tech-challenge-infra-k8s && terraform destroy -auto-approve

# 4. Banco e VPC
cd ~/dev/fiap-tech-challenge-infra-db && terraform destroy -auto-approve
```

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
2. Rode `refresh-aws-secrets.sh` de novo — os secrets do GitHub têm a credencial **antiga**
3. Se um `terraform apply` foi interrompido pela expiração, rode `terraform plan` antes de reaplicar:
   o estado pode ter recursos criados mas não registrados

> Renovar a credencial local **não** renova os secrets do GitHub. Esquecer o passo 2 é a causa mais
> comum de "funciona no meu terminal e falha no CI".
