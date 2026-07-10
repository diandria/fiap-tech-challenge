# Car Repair Shop API

![CI](https://github.com/diandria/fiap-tech-challenge/actions/workflows/ci.yml/badge.svg)
![CD](https://github.com/diandria/fiap-tech-challenge/actions/workflows/cd.yml/badge.svg)

REST API para gerenciar ordens de serviço de uma oficina mecânica — FIAP Tech Challenge Fase 2.

---

## Sumário

1. [Sobre a Fase 2](#sobre-a-fase-2)
2. [Arquitetura](#arquitetura)
3. [Stack](#stack)
4. [Papéis de usuário](#papéis-de-usuário)
5. [Execução local — Docker Compose](#execução-local--docker-compose)
6. [Kubernetes + Minikube](#kubernetes--minikube)
7. [Infraestrutura com Terraform](#infraestrutura-com-terraform)
8. [CI/CD](#cicd)
9. [Testes](#testes)
10. [Postman](#postman)
11. [API Reference (Swagger)](#api-reference-swagger)

---

## Sobre a Fase 2

A Fase 2 evoluiu a aplicação da Fase 1 com foco em qualidade, resiliência e escalabilidade:

- **Clean Architecture + SOLID**: refatoração com separação de camadas, ports/interfaces e eliminação de violações de DIP, SRP e OCP.
- **Testes automatizados**: cobertura de unitários e integração para todos os fluxos críticos (threshold ≥ 80%).
- **Containerização**: Dockerfile otimizado e docker-compose para desenvolvimento local.
- **Kubernetes**: manifests YAML com Deployment, Service (LoadBalancer), HPA (escala por CPU), PDB e StatefulSet do MongoDB.
- **IaC com Terraform**: provisionamento do cluster e aplicação dos manifests via provider `gavinbunney/kubectl`.
- **CI/CD**: pipeline completo no GitHub Actions — build, lint, teste, build de imagem Docker e deploy automatizado no cluster Minikube via self-hosted runner.

---

## Arquitetura

O desenho da arquitetura está dividido em três visões complementares:

| Visão | Documento | Conteúdo |
|---|---|---|
| **Componentes da aplicação** | [Diagramas C4](docs/architecture/c4.md) | Context, Container e Component — visão em três níveis |
| **Infraestrutura provisionada** | [Desenho de solução](docs/infrastructure/solution-design.md) | Cluster Minikube, recursos K8s (Deployment, HPA, StatefulSet, Services…) e fluxo do tráfego |
| **Fluxo de deploy** | [Fluxo de deploy](docs/infrastructure/deploy-flow.md) | Diagrama CI/CD, manifests K8s e recursos Terraform |

Documentação complementar:

| Documento | Conteúdo |
|---|---|
| [Catálogo de componentes](docs/architecture/components.md) | Inventário de todas as classes por camada Clean Architecture |
| [Regras de negócio](docs/architecture/business-rules.md) | Máquina de estados da OS, cálculo de orçamento, gestão de estoque |
| [DAS](docs/architecture/DAS.md) | Documento de Arquitetura de Software completo |
| [Linguagem ubíqua](docs/architecture/ddd/ubiquitous-language.md) | Glossário de domínio |

### Visão geral da arquitetura

```
┌────────────────────────────────────────────────────────────┐
│                     GitHub Actions                         │
│                                                            │
│  CI (ubuntu-latest)          CD (self-hosted / Minikube)  │
│  build → lint → test  ──►    docker build                  │
│                              terraform apply               │
│                              kubectl rollout               │
└──────────────────────────────────────┬─────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────┐
│              Kubernetes — namespace: oficina               │
│                                                            │
│   ┌──────────────────┐        ┌──────────────────────┐    │
│   │  oficina-app     │        │  mongo-0             │    │
│   │  Deployment      │──────► │  StatefulSet         │    │
│   │  2–10 réplicas   │ :27017 │  PVC: 5 Gi           │    │
│   │  HPA (CPU 70%)   │        └──────────────────────┘    │
│   └────────┬─────────┘                                     │
│            │                                               │
│   Service (LoadBalancer :8080)                             │
└────────────┼───────────────────────────────────────────────┘
             │
       minikube tunnel
             │
      http://localhost:8080
```

### Clean Architecture — camadas

```
src/
├── entities/          ← Layer 1: domínio puro (ServiceOrder, Customer, state machine)
├── use-cases/         ← Layer 2: regras de aplicação + ports/interfaces
│   └── ports/         ← abstrações (IServiceOrderRepository, IStatusChangeNotifier…)
├── adapters/          ← Layer 3: controllers, gateways, presenters
└── frameworks/        ← Layer 4: Express, Mongoose, rotas, main.ts
```

---

## Stack

| Tema | Escolha |
|---|---|
| Runtime | Node.js 20 + TypeScript |
| HTTP | Express |
| Banco | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Docs API | swagger-ui-express + swagger-jsdoc |
| Testes | Jest + ts-jest + Supertest + mongodb-memory-server |
| Container | Docker + docker-compose |
| Orquestração | Kubernetes (Minikube) |
| IaC | Terraform (`gavinbunney/kubectl` provider) |
| CI/CD | GitHub Actions (CI em ubuntu-latest, CD em self-hosted) |

---

## Papéis de usuário

| Role | Permissões |
|---|---|
| `attendant` | Abre OS; cadastra clientes e veículos; registra entrega |
| `mechanic` | Executa diagnóstico; refina serviços e itens; executa e finaliza a OS |
| `admin` | Acesso total — inclui gestão de catálogo, estoque e usuários |

Aprovação e rejeição de orçamento usam endpoint **público** (`PATCH /service-orders/:id/budget`) confirmado com os primeiros 4 dígitos do CPF/CNPJ do cliente.

---

## Execução local — Docker Compose

### Pré-requisitos

- Docker + docker-compose
- Node.js 20+ (apenas para `npm install` e `seed:dev`)

### 1. Variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` se precisar mudar `ADMIN_PASSWORD` ou `JWT_SECRET`.

### 2. Subir os containers

```bash
npm install
docker-compose up -d
```

Sobe `app` (porta 3000) e `mongo` (porta 27017).

### 3. Popular o banco (opcional)

```bash
npm run seed:dev
```

Cria 5 serviços, 6 itens, 4 clientes, 7 veículos e 3 usuários (`admin@dev.local`, `attendant@dev.local`, `mechanic@dev.local`, senha `dev123`).

### 4. Verificar

```bash
curl http://localhost:3000/health
```

- API: <http://localhost:3000>
- Swagger: <http://localhost:3000/docs>

### Parar

```bash
docker-compose down          # mantém dados
docker-compose down -v       # remove volumes
```

---

## Kubernetes + Minikube

Ambiente que replica o pipeline de CD. Usa os manifests em `/k8s` e a IaC em `/infra`.

### Pré-requisitos

- [Minikube](https://minikube.sigs.k8s.io/docs/start/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Terraform ≥ 1.0](https://developer.hashicorp.com/terraform/install)

### Início rápido (WSL2 / Linux)

O script `start.sh` faz tudo em sequência — DNS, Minikube, tunnel e runner:

```bash
./scripts/start.sh
```

Após a conclusão, a API estará em `http://localhost:8080`.

### Passo a passo manual

#### 1. Iniciar o Minikube

```bash
minikube start --driver=docker
minikube addons enable metrics-server   # necessário para o HPA
```

#### 2. Iniciar o tunnel (terminal separado, manter aberto)

```bash
minikube tunnel
```

#### 3. Configurar o Terraform

```bash
cp infra/terraform.tfvars.example infra/terraform.tfvars
```

Edite `infra/terraform.tfvars`:

```hcl
kubeconfig_path    = "~/.kube/config"
kubeconfig_context = "minikube"

jwt_secret          = "<string longa e aleatória>"
admin_password      = "<senha do admin>"
mongo_root_username = "admin"
mongo_root_password = "<senha root do MongoDB>"
```

> `terraform.tfvars` está no `.gitignore` — nunca commite credenciais reais.

#### 4. Aplicar infraestrutura

```bash
cd infra/
terraform init
terraform apply
cd ..
```

#### 5. Verificar

```bash
kubectl get pods -n oficina       # todos Running
kubectl get hpa -n oficina        # status do autoscaler
curl http://localhost:8080/health
```

- API: <http://localhost:8080>
- Swagger: <http://localhost:8080/docs>

### Popular o banco no cluster (opcional)

```bash
kubectl port-forward svc/mongo-service 27017:27017 -n oficina &
MONGODB_URI=mongodb://root:<senha>@localhost:27017/car-repair-shop?authSource=admin npm run seed:dev
```

### Manifests Kubernetes (`/k8s/`)

| Arquivo | Kind | O que faz |
|---|---|---|
| `namespace.yaml` | Namespace | Isola todos os recursos no namespace `oficina` |
| `configmap.yaml` | ConfigMap | Vars não-sensíveis: `PORT`, `CORS_ORIGIN`, `ADMIN_EMAIL`, SMTP |
| `secret.yaml` | Secret | Vars sensíveis: `MONGODB_URI`, `JWT_SECRET`, credenciais MongoDB e admin |
| `mongo-headless-service.yaml` | Service (headless) | DNS estável por Pod para o StatefulSet |
| `mongo-service.yaml` | Service (ClusterIP) | Acesso interno da aplicação ao MongoDB |
| `mongo-statefulset.yaml` | StatefulSet | MongoDB com volume persistente de 5 Gi |
| `app-deployment.yaml` | Deployment | API Node.js com rolling update e probes de saúde |
| `app-service.yaml` | Service (LoadBalancer :8080) | Expõe a API via `minikube tunnel` em `localhost:8080` |
| `app-hpa.yaml` | HorizontalPodAutoscaler | Escala entre 2 e 10 réplicas (CPU > 70%) |
| `app-pdb.yaml` | PodDisruptionBudget | Garante mínimo de 1 réplica durante manutenção de nó |

### Destruir o ambiente

```bash
cd infra/ && terraform destroy && cd ..
kubectl delete pvc mongo-data-mongo-0 -n oficina   # PVC não removido pelo Terraform
minikube stop
```

---

## Infraestrutura com Terraform

Provider: `gavinbunney/kubectl ~> 1.14` — aplica manifests YAML sem conversão para recursos Terraform nativos.

Os recursos usam `fileset` + `for_each` agrupados por diretório, com um recurso individual para o Secret (usa `templatefile()` para injetar as variáveis sensíveis).

| Recurso Terraform | Manifests aplicados | Depende de |
|---|---|---|
| `kubectl_manifest.namespaces[*]` | `k8s/00-namespaces/*.yaml` | — |
| `kubectl_manifest.config[*]` | `k8s/01-config/*.yaml` | namespaces |
| `kubectl_manifest.mongo[*]` | `k8s/02-mongo/*.yaml` | config |
| `kubectl_manifest.secret` | `k8s/secret.yaml` (templatefile) | namespaces |
| `kubectl_manifest.app[*]` | `k8s/03-app/*.yaml` | mongo, secret |

Documentação completa: [docs/infrastructure/deploy-flow.md](docs/infrastructure/deploy-flow.md)

---

## CI/CD

Detalhes completos em [docs/infrastructure/deploy-flow.md](docs/infrastructure/deploy-flow.md).

### CI (`.github/workflows/ci.yml`)

Dispara em push e pull request para `main`. Roda em `ubuntu-latest`.

| Job | Necessita | Comando |
|---|---|---|
| `build` | — | `npm ci && npm run build` |
| `lint` | build | `npm run lint` |
| `test` | build | `npm test` |
| `coverage` | build, test | `npm run test:coverage` — faz upload do relatório como artefato |

### CD (`.github/workflows/cd.yml`)

Dispara via `workflow_run` quando o CI conclui com sucesso em `main`. Roda em `self-hosted` (máquina com Minikube).

Passos: checkout no SHA exato → `docker build` no daemon do Minikube → patch da tag de imagem no manifest → `terraform apply` → verificação de rollout.

**GitHub Secrets necessários** (`Settings → Secrets and variables → Actions`):

| Secret | Descrição |
|---|---|
| `JWT_SECRET` | Segredo para assinar tokens JWT |
| `ADMIN_PASSWORD` | Senha do usuário administrador |
| `MONGO_ROOT_USERNAME` | Usuário root do MongoDB |
| `MONGO_ROOT_PASSWORD` | Senha root do MongoDB |

---

## Testes

```bash
npm test                  # todos os testes (sem MongoDB externo)
npm run test:coverage     # com relatório de cobertura (threshold ≥ 80%)
```

### SonarQube (opcional)

```bash
docker-compose --profile sonar up -d sonarqube sonar-db
# 1. Acessar http://localhost:9000 (admin/admin → trocar senha)
# 2. Gerar token em My Account → Security
# 3. Preencher SONAR_HOST_URL e SONAR_TOKEN no .env

npm run test:coverage && npm run sonar
```

---

## Postman

A pasta `postman/` contém a coleção e os environments para cada ambiente.

| Environment | Arquivo | `baseUrl` |
|---|---|---|
| Local / Docker Compose | `car-repair-shop.postman_environment.json` | `http://localhost:3000` |
| Kubernetes / Minikube | `car-repair-shop-k8s.postman_environment.json` | `http://localhost:8080` |

Importar: **Import → Upload Files** → selecione a collection + o environment desejado.

Para o ambiente K8s, o `minikube tunnel` deve estar rodando (`./scripts/start.sh` já faz isso automaticamente).

Via CLI com Newman:

```bash
npx newman run postman/car-repair-shop.postman_collection.json \
  -e postman/car-repair-shop.postman_environment.json
```

Veja [`postman/README.md`](postman/README.md) para o fluxo detalhado.

---

## API Reference (Swagger)

| Ambiente | URL |
|---|---|
| Docker Compose | <http://localhost:3000/docs> |
| Kubernetes | <http://localhost:8080/docs> |

### Autenticar no Swagger UI

1. `POST /auth/login` → **Try it out** → `{ "email": "admin@master.com", "password": "<ADMIN_PASSWORD>" }`
2. Copie o `token`
3. **Authorize** (cadeado) → cole o token sem o prefixo `Bearer ` → **Authorize**

### Endpoints públicos

| Endpoint | Descrição |
|---|---|
| `POST /auth/login` | Autentica e retorna JWT |
| `GET /health` | Liveness probe |
| `GET /ready` | Readiness probe |
| `GET /service-orders/:id/status` | Lê status e orçamento da OS |
| `PATCH /service-orders/:id/budget` | Aprova ou rejeita orçamento (rate-limited) |

