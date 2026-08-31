# Runbook — ambiente efêmero

Documento operacional. O ambiente é recriado do zero a cada sessão do Learner Lab, e este é o
procedimento para subir, verificar e derrubar.

**Escrito para ser seguido sob pressão**, com o ambiente derrubado e tempo contado.

> **Não comece a provisionar meia hora antes de gravar.** A subida completa leva cerca de
> **40 minutos**, e a maior parte é espera de recurso da AWS, que não acelera.

## Tempos medidos

| Etapa | Tempo |
|---|---|
| `infra-db` (VPC + RDS) | ~10 min |
| `infra-k8s` (EKS + addons + observabilidade) | ~20 min |
| `lambda` (duas functions + tópico) | ~2 min |
| Deploy da aplicação (build, push, migration, rollout) | ~5 min |
| Verificação de fumaça | ~3 min |
| **Total** | **~40 min** |

O deploy da aplicação foi cronometrado em execução real. As três primeiras etapas seguem a estimativa
dos milestones correspondentes.

---

## Subida

### 1. Credenciais

No Learner Lab: **Start Lab** → aguarde o círculo verde → **AWS Details** → **AWS CLI** → **Show**.
Cole o bloco em `~/.aws/credentials`.

```bash
aws ec2 describe-vpcs --max-items 1 >/dev/null && echo "credencial ok"
```

> Use uma chamada que **toca recurso**, e não `sts get-caller-identity`: o Learner Lab revoga a
> sessão mantendo o `get-caller-identity` respondendo. A diferença aparece vinte minutos adiante,
> com uma mensagem que não aponta para a causa.

### 2. Publicar as credenciais nos quatro repositórios

```bash
~/dev/fiap-tech-challenge-lambda/scripts/refresh-aws-secrets.sh --todos
```

Sem isso, o CD falha ao tocar a AWS.

### 3. `infra-db` — VPC e banco (~10 min)

```bash
cd ~/dev/fiap-tech-challenge-infra-db
terraform init -input=false && terraform apply -auto-approve
```

Cria a VPC, o RDS e os parâmetros no SSM: senha do banco e **senha do admin da aplicação**.

### 4. `infra-k8s` — cluster e gateway (~20 min)

```bash
cd ~/dev/fiap-tech-challenge-infra-k8s
terraform init -input=false && terraform apply -auto-approve
```

É a etapa mais longa: EKS, addons, ALB controller, observabilidade, ECR e o API Gateway.

> Se o apply falhar no meio, **não interrompa um novo apply pela metade**. Aplies interrompidos
> deixam inconsistência de três camadas (estado do Terraform, release do Helm e o Secret que guarda
> o release), e reconciliar isso leva mais tempo que deixar terminar.

### 5. `lambda` — functions e tópico (~2 min)

```bash
cd ~/dev/fiap-tech-challenge-lambda
(cd functions/auth && npm ci && npm run build)
(cd functions/notifications && npm ci && npm run build)
terraform -chdir=terraform init -input=false && terraform -chdir=terraform apply -auto-approve
```

Gera `JWT_SECRET` e `INTERNAL_TOKEN` no SSM. A aplicação lê **os mesmos parâmetros** — não há duas
cópias para divergir.

### 6. Aplicação

Merge na `main` dispara o CD. Para forçar sem um commit novo:

```bash
gh workflow run CI --repo diandria/fiap-tech-challenge --ref main
```

O CD constrói a imagem, publica no ECR, roda a migration como Job, faz `set image` e verifica o
rollout — com rollback se falhar.

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
# 5. Grafana com dados
kubectl port-forward -n observability svc/kube-prometheus-stack-grafana 3000:80
```

---

## Descida

**Ordem inversa da subida.** Não pule etapas: derrubar a VPC antes do cluster deixa recursos órfãos
que continuam faturando.

```bash
# 1. Aplicação
kubectl delete -f ~/dev/fiap-tech-challenge/k8s/03-app/ --ignore-not-found

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
