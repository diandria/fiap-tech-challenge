# Car Repair Shop API

![CI](https://github.com/diandria/fiap-tech-challenge/actions/workflows/ci.yml/badge.svg)
![CD](https://github.com/diandria/fiap-tech-challenge/actions/workflows/cd.yml/badge.svg)

REST API para gerenciar ordens de serviço de uma oficina mecânica. Implementa Clean Architecture, empacotada com Docker e orquestrada em Kubernetes via Terraform, com pipeline CI/CD completo no GitHub Actions.

- Arquitetura: [docs/c4.md](docs/c4.md)
- Regras de negócio: [docs/business-rules.md](docs/business-rules.md)
- Componentes: [docs/components.md](docs/components.md)
- Deploy e infraestrutura: [docs/deploy-flow.md](docs/deploy-flow.md)
- Demo: <!-- TODO: adicionar link do vídeo (máx. 15 min) antes da entrega -->

---

## Sumário

1. [Stack](#stack)
2. [Papéis de usuário](#papéis-de-usuário)
3. [Opção A — Docker Compose (dev local)](#opção-a--docker-compose-dev-local)
4. [Opção B — Kubernetes + Minikube](#opção-b--kubernetes--minikube)
5. [Configuração de credenciais](#configuração-de-credenciais)
6. [Seed de desenvolvimento](#seed-de-desenvolvimento)
7. [Testes](#testes)
8. [Postman](#postman)
9. [API Reference (Swagger)](#api-reference-swagger)
10. [CI/CD](#cicd)

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
| Orquestração | Kubernetes (Minikube) + Terraform |

---

## Papéis de usuário

| Role | Permissões |
|---|---|
| `attendant` | Abre OS; cadastra clientes e veículos; registra entrega |
| `mechanic` | Executa diagnóstico; refina serviços e itens; executa e finaliza a OS |
| `admin` | Acesso total — inclui gestão de catálogo, estoque e usuários |

Aprovação e rejeição de orçamento usam endpoint **público** (`PATCH /service-orders/:id/budget`) confirmado com os primeiros 4 dígitos do CPF/CNPJ do cliente.

---

## Opção A — Docker Compose (dev local)

A forma mais rápida de rodar tudo localmente. Sobe a API e o MongoDB em containers.

### Pré-requisitos

- Node.js 20+
- Docker + docker-compose

### 1. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` se precisar mudar `ADMIN_PASSWORD` ou `JWT_SECRET`.

### 2. Instalar dependências

```bash
npm install
```

### 3. Subir os containers

```bash
docker-compose up -d
```

Sobe `app` (porta 3000) e `mongo` (porta 27017). Aguarde alguns segundos para o MongoDB inicializar.

> Para rodar a API com hot-reload via ts-node: `docker-compose up -d mongo && npm run dev`

### 4. Popular o banco com dados de exemplo

```bash
npm run seed:dev
```

Cria serviços, itens, clientes, veículos e 3 usuários (`admin@dev.local`, `attendant@dev.local`, `mechanic@dev.local`, senha `dev123`).

### 5. Verificar que está no ar

```bash
curl http://localhost:3000/health
```

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/docs>

### Parar

```bash
docker-compose down

# Com remoção de volumes (dados perdidos)
docker-compose down -v
```

---

## Opção B — Kubernetes + Minikube

Ambiente de produção local usando os manifests de `/k8s` e o módulo Terraform de `/infra`. Replica o mesmo ambiente que o pipeline de CD usa.

### Pré-requisitos

- [Minikube](https://minikube.sigs.k8s.io/docs/start/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Terraform >= 1.0](https://developer.hashicorp.com/terraform/install)

### 1. Configurar as variáveis do Terraform

Copie o arquivo de exemplo e preencha com as credenciais reais:

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

### 2. Iniciar o Minikube

```bash
minikube start --cpus=2 --memory=4096
minikube addons enable metrics-server   # obrigatório para o HPA funcionar
```

### 3. Aplicar a infraestrutura com Terraform

```bash
cd infra/
terraform init        # baixa o provider gavinbunney/kubectl — uma única vez
terraform plan        # visualiza o que será criado
terraform apply       # aplica todos os manifests na ordem correta
cd ..
```

### 4. Obter a URL da aplicação

```bash
minikube service oficina-service -n oficina --url
```

A API responde na URL retornada (NodePort 30080). O Swagger fica em `<url>/docs`.

### 5. Popular o banco (opcional)

Com a URL obtida no passo anterior, configure `MONGODB_URI` no `.env` apontando para o MongoDB do cluster ou rode o seed contra o banco do Kubernetes:

```bash
# Expor o MongoDB via port-forward para rodar o seed localmente
kubectl port-forward svc/mongo-service 27017:27017 -n oficina &
MONGODB_URI=mongodb://root:<senha>@localhost:27017/car-repair-shop?authSource=admin npm run seed:dev
```

### Verificar o ambiente

```bash
kubectl get pods -n oficina          # todos devem estar Running
kubectl get all -n oficina           # visão completa do namespace
kubectl get hpa -n oficina           # status do autoscaler
kubectl logs -l app.kubernetes.io/name=oficina-app -n oficina -f   # logs da API
```

### Destruir o ambiente

```bash
cd infra/
terraform destroy
cd ..

# PVCs do MongoDB não são removidos pelo Terraform — excluir manualmente:
kubectl delete pvc mongo-data-mongo-0 -n oficina
```

### Manifests Kubernetes (`/k8s/`)

| Arquivo | Kind | O que faz |
|---|---|---|
| `namespace.yaml` | Namespace | Isola todos os recursos no namespace `oficina` |
| `configmap.yaml` | ConfigMap | Vars não-sensíveis: `PORT`, `CORS_ORIGIN`, `ADMIN_EMAIL`, SMTP |
| `secret.yaml` | Secret | Vars sensíveis: `MONGODB_URI`, `JWT_SECRET`, credenciais MongoDB e admin |
| `mongo-headless-service.yaml` | Service (headless) | DNS estável por Pod para o StatefulSet |
| `mongo-service.yaml` | Service (ClusterIP) | Ponto de acesso da aplicação ao MongoDB |
| `mongo-statefulset.yaml` | StatefulSet | MongoDB com volume persistente de 5 Gi |
| `app-deployment.yaml` | Deployment | API Node.js com rolling update e probes de saúde |
| `app-service.yaml` | Service (NodePort 30080) | Expõe a API fora do cluster |
| `app-hpa.yaml` | HorizontalPodAutoscaler | Escala entre 2 e 10 réplicas (CPU > 70%) |
| `app-pdb.yaml` | PodDisruptionBudget | Garante mínimo de 1 réplica durante manutenção de nó |

---

## Configuração de credenciais

### Docker Compose (`.env`)

| Variável | Descrição | Obrigatória |
|---|---|---|
| `PORT` | Porta HTTP (default: `3000`) | Não |
| `MONGODB_URI` | Connection string do MongoDB | Sim |
| `JWT_SECRET` | Segredo para assinar JWTs | Sim |
| `CORS_ORIGIN` | Origens permitidas (separadas por vírgula) | Não |
| `ADMIN_EMAIL` | Email do admin padrão | Não |
| `ADMIN_PASSWORD` | Senha do admin padrão | Não |
| `SONAR_HOST_URL` | URL do SonarQube local | Não |
| `SONAR_TOKEN` | Token do SonarQube | Não |

### Kubernetes (via Terraform)

Os secrets do Kubernetes são gerenciados pelo Terraform a partir de `infra/terraform.tfvars` (local) ou variáveis `TF_VAR_*` (CI/CD). O Secret contém: `MONGODB_URI`, `JWT_SECRET`, `ADMIN_PASSWORD`, `MONGO_ROOT_USERNAME` e `MONGO_ROOT_PASSWORD`.

### Trocar senhas

O seed cria o admin na **primeira execução**. Se o admin já existe no banco com a senha antiga:

```bash
# Docker Compose — acessar o Mongo e apagar o usuário
docker exec -it <container-mongo> mongosh car-repair-shop --eval 'db.users.deleteOne({ email: "admin@master.com" })'
```

Reinicie a aplicação; o seed recria o admin com o novo `ADMIN_PASSWORD`.

---

## Seed de desenvolvimento

```bash
npm run seed:dev
```

Popula o banco com dados fixos para testes manuais:

- **5 serviços**: Oil Change, Wheel Alignment, Brake Pad Replacement, Battery Check, Engine Tune-up
- **6 itens em estoque**: 5W30 Oil, Front Brake Pad Kit, Air Filter, Battery 60Ah, Spark Plug, Engine Coolant
- **4 clientes** (3 CPFs + 1 CNPJ)
- **7 veículos** distribuídos entre os clientes
- **3 usuários** (senha: `dev123`): `admin@dev.local`, `attendant@dev.local`, `mechanic@dev.local`

O script é **idempotente** — pode rodar várias vezes; registros existentes são pulados.

---

## Testes

```bash
# Roda todos os testes (usa mongodb-memory-server — sem MongoDB externo necessário)
npm test

# Com relatório de cobertura (threshold >= 80%)
npm run test:coverage
```

### SonarQube (opcional)

```bash
# Subir o SonarQube local
docker-compose --profile sonar up -d sonarqube sonar-db

# 1. Acessar http://localhost:9000 (login: admin/admin, trocar senha)
# 2. Gerar token em My Account → Security
# 3. Preencher no .env: SONAR_HOST_URL e SONAR_TOKEN

npm run test:coverage   # gera coverage/lcov.info
npm run sonar           # envia análise para o servidor local
```

Resultado em `http://localhost:9000/dashboard?id=car-repair-shop-api`.

---

## Postman

A pasta `postman/` contém a coleção com o fluxo completo ponta a ponta.

```
# Importar no Postman:
postman/car-repair-shop.postman_collection.json
postman/car-repair-shop.postman_environment.json

# Selecionar o environment "Car Repair Shop - Local"
# Confirmar adminPassword no environment (deve bater com ADMIN_PASSWORD do .env)
# Executar na ordem das pastas (00 → 06) — IDs e tokens são propagados automaticamente
```

Via CLI com Newman:

```bash
npx newman run postman/car-repair-shop.postman_collection.json \
  -e postman/car-repair-shop.postman_environment.json
```

Veja `postman/README.md` para o fluxo detalhado de cada pasta.

---

## API Reference (Swagger)

Swagger UI disponível em `/docs` enquanto o servidor está no ar:

- Docker Compose: <http://localhost:3000/docs>
- Kubernetes: `<minikube-url>/docs`

### Autenticar no Swagger UI

1. Abra `POST /auth/login` → **Try it out** → envie `{ "email": "admin@master.com", "password": "<ADMIN_PASSWORD>" }`
2. Copie o `token` da resposta
3. Clique em **Authorize** (cadeado, canto superior direito) → cole o token **sem** o prefixo `Bearer ` → **Authorize** → **Close**

Todos os endpoints protegidos passam a enviar `Authorization: Bearer <token>` automaticamente.

### Endpoints públicos (sem token)

| Endpoint | Descrição |
|---|---|
| `POST /auth/login` | Autentica e retorna JWT |
| `GET /health` | Liveness probe |
| `GET /ready` | Readiness probe |
| `GET /service-orders/:id/status` | Lê status e orçamento da OS |
| `PATCH /service-orders/:id/budget` | Aprova ou rejeita orçamento (rate-limited) |

### Principais grupos de endpoints

| Rota | Roles | Descrição |
|---|---|---|
| `POST /auth/register` | admin | Cria usuário |
| `GET\|POST\|PUT\|DELETE /customers` | attendant, admin | CRUD de clientes |
| `GET\|POST\|PUT\|DELETE /vehicles` | attendant, admin | CRUD de veículos |
| `GET\|POST\|PUT\|DELETE /services` | GET: autenticado; escrita: admin | CRUD do catálogo de serviços |
| `GET /services/avg-time` | autenticado | Tempo médio de execução por serviço |
| `GET\|POST\|PUT\|DELETE /items` | GET: autenticado; escrita: admin | CRUD de itens de estoque |
| `POST /service-orders` | attendant, admin | Abre uma OS |
| `GET /service-orders` | autenticado | Lista OS ativas por prioridade operacional |
| `PATCH /service-orders/:id` | mechanic, admin | Transições internas da OS |
| `POST\|DELETE /service-orders/:id/services` | mechanic, admin | Adiciona/remove serviço da OS em DIAGNOSIS |
| `POST\|DELETE /service-orders/:id/items` | mechanic, admin | Adiciona/remove item da OS em DIAGNOSIS |

---

## CI/CD

Detalhes completos em [docs/deploy-flow.md](docs/deploy-flow.md).

### CI (`.github/workflows/ci.yml`)

Dispara em push e pull request para `main`. Roda em `ubuntu-latest`.

| Job | Necessita | Comando |
|---|---|---|
| `build` | — | `npm ci && npm run build` |
| `lint` | build | `npm run lint` |
| `test` | build | `npm test` |

### CD (`.github/workflows/cd.yml`)

Dispara via `workflow_run` quando o CI conclui com sucesso em `main`. Roda em `self-hosted` (máquina com Minikube).

Passos: checkout no SHA exato do CI → `docker build` no daemon do Minikube → patch da tag de imagem no manifest → `terraform apply` → verificação de rollout dos pods.

**GitHub Secrets necessários** (configurar em `Settings → Secrets and variables → Actions`):

| Secret | Descrição |
|---|---|
| `JWT_SECRET` | Segredo para assinar tokens JWT |
| `ADMIN_PASSWORD` | Senha do usuário administrador |
| `MONGO_ROOT_USERNAME` | Usuário root do MongoDB |
| `MONGO_ROOT_PASSWORD` | Senha root do MongoDB |
