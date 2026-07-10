# Fluxo de Deploy

## Pipeline CI/CD

Todo deploy é condicionado ao pipeline de CI. O CD escuta a conclusão do CI via `workflow_run` e só executa quando o CI conclui com sucesso na `main`.

```mermaid
flowchart TB
    push(["Push na main"]) --> ci

    subgraph ci["Workflow CI — .github/workflows/ci.yml (ubuntu-latest)"]
        build["build\nnpm ci + npm run build"]
        lint["lint\nnpm run lint"]
        test["test\nnpm test"]
        coverage["coverage\nnpm run test:coverage\n(artefato, 3 dias)"]
        build --> lint
        build --> test
        test --> coverage
    end

    ci -->|"workflow_run: completed\nconclusion: success"| cd

    subgraph cd["Workflow CD — .github/workflows/cd.yml (self-hosted / host do Minikube)"]
        checkout["1. Checkout no SHA exato\ntestado pelo CI"]
        docker["2. docker build\n→ daemon do Minikube"]
        patch["3. Patch da tag de imagem\nem k8s/app-deployment.yaml"]
        tf["4. terraform init + apply\n(secrets via GitHub Secrets)"]
        rollout["5. kubectl rollout status\nmongo (180s) + app (120s)"]
        checkout --> docker --> patch --> tf --> rollout
    end

    cd --> cluster["Cluster Minikube\nnamespace: oficina"]
```

> A visão da infraestrutura provisionada (recursos do cluster) está em [solution-design.md](solution-design.md).

### Jobs do CI

| Job | Depende de | Runner | Comando |
|---|---|---|---|
| `build` | — | ubuntu-latest | `npm ci && npm run build` |
| `lint` | build | ubuntu-latest | `npm run lint` |
| `test` | build | ubuntu-latest | `npm test` |
| `coverage` | build, test | ubuntu-latest | `npm run test:coverage` — faz upload do relatório como artefato (retido 3 dias) |

### Passos do CD

| Passo | Detalhe |
|---|---|
| Checkout | `actions/checkout@v4` com `ref: github.event.workflow_run.head_sha` — fixa exatamente o commit testado pelo CI |
| Tag da imagem | SHA curto do git (`git rev-parse --short HEAD`) |
| Build do Docker | `eval $(minikube docker-env)` seguido de `docker build` — a imagem fica no daemon do Minikube |
| Patch do manifest | `sed` substitui a tag de imagem em `k8s/app-deployment.yaml`; validado por uma asserção com `grep` |
| Terraform apply | `terraform init -input=false && terraform apply -auto-approve -input=false` a partir de `infra/` |
| Verificação do rollout | `kubectl rollout status statefulset/mongo` (180 s) e depois `kubectl rollout status deployment/oficina-app` (120 s) |

O CD usa `concurrency: { group: deploy, cancel-in-progress: true }` — execuções sobrepostas cancelam a mais antiga. O timeout total do job é de 15 minutos.

---

## Manifests Kubernetes (`k8s/`)

| Arquivo | Kind | Função |
|---|---|---|
| `namespace.yaml` | Namespace | Isola todos os recursos no namespace `oficina` |
| `configmap.yaml` | ConfigMap | Variáveis não sensíveis: `PORT`, `CORS_ORIGIN`, `ADMIN_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM` |
| `secret.yaml` | Secret | Variáveis sensíveis: `MONGODB_URI`, `JWT_SECRET`, `ADMIN_PASSWORD`, `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`, credenciais SMTP |
| `app-deployment.yaml` | Deployment | Pods da aplicação; `imagePullPolicy: IfNotPresent` (usa a imagem local do Minikube) |
| `app-service.yaml` | Service | LoadBalancer (:8080) — acessível em `localhost:8080` via `minikube tunnel` |
| `app-hpa.yaml` | HorizontalPodAutoscaler | Escala o deployment `oficina-app` por utilização de CPU (alvo: 70%) |
| `app-pdb.yaml` | PodDisruptionBudget | Garante um mínimo de pods disponíveis durante disrupções voluntárias |
| `mongo-statefulset.yaml` | StatefulSet | Réplica única do MongoDB; PVC nomeado `mongo-data-mongo-0` |
| `mongo-service.yaml` | Service | ClusterIP — acesso interno da aplicação ao MongoDB |
| `mongo-headless-service.yaml` | Service (headless) | Exigido pelo StatefulSet para identidade DNS estável do pod |

---

## Recursos Terraform (`infra/`)

Provider: `gavinbunney/kubectl ~> 1.14` — aplica os manifests YAML diretamente, sem convertê-los em blocos de recurso nativos do Terraform.

Os recursos usam `fileset` + `for_each` agrupados por diretório, com um recurso individual para o secret (usa `templatefile()`).

| Recurso | Manifests aplicados | Depende de |
|---|---|---|
| `kubectl_manifest.namespaces[*]` | `k8s/00-namespaces/*.yaml` | — |
| `kubectl_manifest.secret` | `infra/templates/secret.yaml.tpl` | namespaces |
| `kubectl_manifest.config[*]` | `k8s/01-config/*.yaml` | namespaces |
| `kubectl_manifest.mongo[*]` | `k8s/02-mongo/*.yaml` | secret, config |
| `kubectl_manifest.app[*]` | `k8s/03-app/*.yaml` | mongo |

O `secret` é um recurso individual que usa `templatefile()` para interpolar as credenciais a partir de variáveis do Terraform. Os campos são marcados com `sensitive_fields = ["data", "stringData"]` para impedir que credenciais apareçam nos diffs do state.

### Variáveis

| Variável | Padrão | Descrição |
|---|---|---|
| `kubeconfig_path` | `~/.kube/config` | Caminho do kubeconfig; expandido com `pathexpand()` |
| `kubeconfig_context` | `minikube` | Contexto a usar dentro do kubeconfig |

### Outputs

| Output | Valor |
|---|---|
| `app_url` | `http://localhost:8080` (após `minikube tunnel` em execução) |
| `namespace` | `oficina` |

---

## Executando Localmente

**Pré-requisitos:** Minikube instalado, `kubectl` e `terraform` no PATH.

### Início rápido (WSL2 / Linux)

```bash
./scripts/start.sh
# Inicia Minikube, aponta Docker ao daemon do Minikube,
# sobe minikube tunnel em background e inicia o runner do GitHub Actions.
# API disponível em http://localhost:8080
```

### Passo a passo manual

```bash
# 1. Iniciar o Minikube
minikube start --driver=docker
minikube addons enable metrics-server

# 2. Iniciar tunnel (terminal separado, manter aberto)
minikube tunnel

# 3. Configurar credenciais
cp infra/terraform.tfvars.example infra/terraform.tfvars
# Editar infra/terraform.tfvars com jwt_secret, admin_password, mongo_root_password

# 4. Aplicar infraestrutura
cd infra/
terraform init
terraform apply
cd ..

# 5. Verificar
kubectl get pods -n oficina
curl http://localhost:8080/health

# 6. Destruir
cd infra/ && terraform destroy && cd ..
kubectl delete pvc mongo-data-mongo-0 -n oficina
minikube stop
```
