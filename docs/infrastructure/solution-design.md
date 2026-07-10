# Desenho de Solução — Infraestrutura

Visão da infraestrutura provisionada: cluster Kubernetes (Minikube), recursos do namespace `oficina` e o caminho do tráfego do usuário até o banco de dados.

Complementa as outras duas visões da arquitetura:

- Componentes da aplicação: [docs/architecture/c4.md](../architecture/c4.md)
- Fluxo de deploy (CI/CD): [deploy-flow.md](deploy-flow.md)

## Diagrama

```mermaid
flowchart TB
    dev["Desenvolvedor"] -->|"push na main"| gha["GitHub Actions\nCI: ubuntu-latest\nCD: runner self-hosted"]
    user["Usuário / Postman"] -->|"HTTP :8080\nvia minikube tunnel"| svc

    subgraph host["Host WSL2 / Linux — runner self-hosted"]
        gha -->|"docker build (daemon do Minikube)\n+ terraform apply"| mk

        subgraph mk["Cluster Minikube (driver docker) + addon metrics-server"]
            subgraph ns["namespace: oficina"]
                svc["Service LoadBalancer\noficina-service\n:8080 → :3000"]

                subgraph app["Aplicação"]
                    dep["Deployment oficina-app\nNode.js 20 · 2 a 10 réplicas\nprobes: startup/liveness/readiness"]
                    hpa["HPA oficina-hpa\nCPU > 70%\nmin 2 / max 10"]
                    pdb["PDB oficina-pdb\nminAvailable: 1"]
                end

                subgraph config["Configuração"]
                    cm["ConfigMap\noficina-config\nPORT, CORS, SMTP…"]
                    sec["Secret oficina-secret\nMONGODB_URI, JWT_SECRET,\ncredenciais MongoDB e admin"]
                end

                subgraph db["Banco de dados"]
                    msvc["Service ClusterIP\nmongo-service :27017"]
                    hsvc["Service headless\nmongo-headless"]
                    sts["StatefulSet mongo\nmongo:7 · 1 réplica"]
                    pvc["PVC mongo-data\n5 Gi · ReadWriteOnce"]
                end

                svc --> dep
                hpa -.->|"escala"| dep
                pdb -.->|"protege"| dep
                cm -.->|"envFrom"| dep
                sec -.->|"envFrom"| dep
                sec -.->|"MONGO_INITDB_ROOT_*"| sts
                dep -->|"Mongoose\n:27017"| msvc
                msvc --> sts
                hsvc -.->|"DNS estável do pod"| sts
                sts ---|"/data/db"| pvc
            end
        end
    end
```

## Recursos provisionados

Todos os recursos abaixo são aplicados pelo Terraform (`infra/`) a partir dos manifests em `/k8s` — detalhes de dependências e variáveis em [deploy-flow.md](deploy-flow.md#terraform-resources-infra).

| Recurso | Nome | Função na solução |
|---|---|---|
| Namespace | `oficina` | Isola todos os recursos da aplicação |
| Deployment | `oficina-app` | API Node.js com rolling update, probes e limites de CPU/memória |
| HorizontalPodAutoscaler | `oficina-hpa` | Escala de 2 a 10 réplicas quando CPU > 70% (requer metrics-server) |
| PodDisruptionBudget | `oficina-pdb` | Garante ao menos 1 réplica durante disrupções voluntárias |
| Service (LoadBalancer) | `oficina-service` | Expõe a API em `localhost:8080` via `minikube tunnel` |
| ConfigMap | `oficina-config` | Variáveis não sensíveis (porta, CORS, SMTP) |
| Secret | `oficina-secret` | Variáveis sensíveis (URI do MongoDB, JWT, credenciais) — gerado pelo Terraform via `templatefile()` |
| StatefulSet | `mongo` | MongoDB 7 com identidade estável e volume persistente |
| Service (ClusterIP) | `mongo-service` | Acesso interno da API ao MongoDB na porta 27017 |
| Service (headless) | `mongo-headless` | DNS estável por pod, exigido pelo StatefulSet |
| PersistentVolumeClaim | `mongo-data-mongo-0` | 5 Gi (ReadWriteOnce) para `/data/db` |

## Decisões e trade-offs

- **Minikube via runner self-hosted em vez de cloud**: elimina custo de infraestrutura gerenciada mantendo CI/CD completo; o trade-off é a dependência de uma máquina local ligada para o CD executar.
- **MongoDB como StatefulSet no cluster em vez de banco gerenciado**: mantém todo o provisionamento reproduzível via Terraform + manifests; o trade-off é operar backup/retenção manualmente (PVC de 5 Gi).
- **Service LoadBalancer + `minikube tunnel` em vez de Ingress**: menor complexidade para um único serviço exposto; um Ingress passaria a valer a pena com múltiplos serviços ou TLS.
