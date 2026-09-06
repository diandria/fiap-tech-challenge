# Roteiro do vídeo

Roteiro cronometrado da gravação. O [checklist de gravação](checklist-gravacao.md) prepara o
ambiente; este documento é o que se segue **com a câmera ligada**.

**Limite: 15 minutos.** O roteiro fecha em 13:30, com 1:30 de folga. Se um bloco estourar, corte do
bloco seguinte, nunca do fim: o encerramento tem os links que o avaliador procura.

## O que o enunciado exige, e onde cada item aparece

| Exigência | Bloco |
|---|---|
| Autenticação com CPF | 3 |
| Geração e utilização do JWT | 3 |
| Consumo das APIs protegidas | 3 e 4 |
| Execução da pipeline de CI/CD | 2 e 8 |
| Deploy automatizado | 2 e 8 |
| Dashboards de monitoramento | 7 |
| Logs estruturados | 5 |
| Correlação das requisições | 5 |
| Traces em execução | 6 |

Além disso, a coordenação pediu que o vídeo mostre **PR, merge na `main`, pipeline e deploy da nova
versão**. É o bloco 2 (início) e o bloco 8 (resultado).

---

## Preparação: o que precisa estar pronto antes de apertar "gravar"

Tudo aqui vem depois do checklist de gravação, com o ambiente de pé e a carga do k6 já executada.

### 1. Um PR pronto para mergear

O CI e o CD levam **cerca de 11 minutos** somados (CI ~3:30, imagem ~2:00, deploy ~5:00). Não há
como esperar isso ao vivo, então o merge acontece **no minuto 1** e o resultado aparece **no minuto
12**. Entre um e outro, o resto do roteiro.

A mudança precisa ser trivial, segura e **visível pelo gateway**. A sugestão é a versão do Swagger:

```bash
cd ~/dev/fiap-tech-challenge
git checkout -b chore/versao-da-api-na-gravacao
sed -i "s/version: '1.0.0'/version: '1.1.0'/" src/frameworks/http/swagger/setup.ts
git commit -am "chore: bump api version shown in swagger"
git push -u origin chore/versao-da-api-na-gravacao
gh pr create --fill
```

Deixe o PR aberto com o **CI verde** antes de gravar. Na gravação você só faz o merge.

### 2. Dados no banco

Um cliente com CPF conhecido e duas ordens de serviço em estados diferentes:

| O que | Para quê |
|---|---|
| Cliente `Ana`, CPF `529.982.247-25` | autenticar por CPF (bloco 3) |
| OS **A** em `DIAGNOSIS` | transição `→ WAITING_APPROVAL`, que publica no SNS (bloco 4) |
| OS **B** em `WAITING_APPROVAL` | aprovação do orçamento pelo cliente, com o código `5299` (bloco 4) |

A carga do k6 já cria clientes e ordens, mas crie **as suas** à mão pelo Postman, para saber os ids.
Anote `OS_A` e `OS_B`. Adicione ao menos um serviço a cada uma antes de fechar o diagnóstico: a
transição não exige, mas um orçamento de zero na tela fica estranho.

### 3. Terminal com as variáveis

Um terminal limpo, fonte grande, com isto já exportado:

```bash
export GW=$(cd ~/dev/fiap-tech-challenge-infra-k8s && terraform output -raw api_gateway_url)
export ADMIN_PASSWORD=$(aws ssm get-parameter --name /car-repair-shop/app/admin-password \
  --with-decryption --query 'Parameter.Value' --output text)
export OS_A=<id>   # em DIAGNOSIS
export OS_B=<id>   # em WAITING_APPROVAL
```

### 4. Abas abertas, nesta ordem

1. Postman com a collection e o environment `car-repair-shop-k8s` (`baseUrl` e `authBaseUrl` = `$GW`)
2. jwt.io, para mostrar o payload do token
3. GitHub: o PR pronto
4. GitHub: `Settings → Branches` do repositório da aplicação (proteção da `main`)
5. GitHub: aba Actions do repositório da aplicação
6. Grafana em `http://localhost:3000`, com o port-forward rodando num terminal à parte
7. Alertmanager em `http://localhost:9093`, idem
8. CloudWatch Logs, grupo `/aws/lambda/car-repair-shop-auth`
9. README do repositório da aplicação, na seção "Documentação arquitetural"

### 5. Alerta disparado

Siga o passo 3 do checklist **uns 3 minutos antes de gravar**, para o `ServiceOrderProcessingFailures`
estar em `firing` quando chegar o bloco 7. Restaure o tópico só depois de gravar.

---

## Roteiro

Coluna "Fala" é o que dizer, não o que ler. Fale por cima do que aparece na tela; não espere
comando terminar em silêncio.

### Bloco 1: Abertura (0:00 a 0:30)

| Tela | Fala |
|---|---|
| README da aplicação, diagrama "Visão geral da arquitetura" | Nome do grupo e do projeto. "A oficina da Fase 2 foi levada para a AWS: API Gateway como entrada única, aplicação no EKS, Postgres no RDS, autenticação por CPF numa Lambda, notificação assíncrona por SNS, e observabilidade com Prometheus, Loki e Tempo. Quatro repositórios, cada um com pipeline própria." |

### Bloco 2: Fluxo de entrega, início (0:30 a 2:00)

| Tela | Fala | Comando |
|---|---|---|
| `Settings → Branches` | "A `main` é protegida: sem push direto, nem para admin, e o merge exige o CI verde." | |
| O PR pronto | "Toda mudança entra por PR. Este muda a versão exposta no Swagger, só para a nova versão ser visível no fim do vídeo." Aponte os checks verdes. | |
| Botão **Merge** | "No merge, o CI roda de novo na `main` e, quando termina, dispara o CD: build da imagem, push no ECR, Job de migration, rollout no EKS com rollback automático, e um smoke test pelo gateway." | clique em **Merge pull request** |
| Aba Actions, CI em execução | "Leva uns dez minutos. Volto aqui no fim." | |

> Não espere. Siga para o bloco 3 imediatamente.

### Bloco 3: Autenticação por CPF e uso do JWT (2:00 a 4:00)

| Tela | Fala | Comando |
|---|---|---|
| Terminal | "Tudo entra pelo gateway. O balanceador do cluster é interno, sem endereço público." | `curl -s $GW/health` |
| Postman, pasta de autenticação de cliente | "O cliente se autentica só com o CPF. Essa rota não é servida pela aplicação: o gateway roteia para a Lambda, que valida o CPF, consulta a existência e o status do cliente na aplicação, e assina o JWT." | `POST {{authBaseUrl}}/auth/cpf` com `{"cpf":"52998224725"}` |
| Resposta 200 | "Token, validade e a identidade do cliente." | |
| jwt.io (aba já aberta) | "O payload do token: `type: customer`, `sub` é o id do cliente, `iss` é a Lambda. Não tem CPF completo nem e-mail além do necessário." | cole o token. Sem navegador: `python3 -c "import sys,base64,json;p=sys.argv[1].split('.')[1];print(json.dumps(json.loads(base64.urlsafe_b64decode(p+'='*(-len(p)%4))),indent=2))" "$TOKEN"` |
| Postman | "Com o token, o cliente consulta o status da própria OS." | `GET /service-orders/{{OS_B}}/status` com o token de cliente → 200 |
| Postman | "Sem token, 401. E o token de cliente numa rota de funcionário dá 403: o token diz quem é, e a aplicação decide o que pode." | mesma rota sem `Authorization` → 401; `GET /service-orders` com token de cliente → 403 |
| Postman | "CPF inválido devolve 400, e CPF desconhecido devolve 401, sem dizer se existe: a rota não pode virar um oráculo de enumeração." | `POST /auth/cpf` com `{"cpf":"11111111111"}` → 400; com um CPF válido não cadastrado → 401 |

### Bloco 4: APIs protegidas e o ciclo da OS (4:00 a 5:30)

| Tela | Fala | Comando |
|---|---|---|
| Postman, `POST /auth/login` | "Funcionários autenticam com e-mail e senha na própria aplicação; o token tem `type: staff` e o perfil." | login como `admin@master.com` |
| Postman | "O mecânico fecha o diagnóstico. Essa transição publica um evento no tópico SNS e segue: a aplicação não espera o e-mail." | `PATCH /service-orders/{{OS_A}}` com `{"status":"WAITING_APPROVAL"}` → 200 |
| Postman, token de cliente | "O cliente aprova o orçamento da OS dele, confirmando com os quatro primeiros dígitos do CPF." | `PATCH /service-orders/{{OS_B}}/budget` com `{"status":"APPROVED","code":"5299"}` → 200 |
| Terminal | "A Lambda de notificações recebeu o evento e entregou a mensagem, formatada." | `aws logs tail /aws/lambda/car-repair-shop-notifications --since 2m --format short` |

> Guarde o `trace_id` da linha da Lambda de notificações. É o fio do bloco 5.

### Bloco 5: Logs estruturados e correlação (5:30 a 7:30)

| Tela | Fala | Comando |
|---|---|---|
| Terminal | "A aplicação loga em JSON. Cada linha tem rota, status, duração e o `trace_id` da requisição." | `kubectl logs -n car-repair-shop -l app=car-repair-shop-api --tail=30 \| jq -c '{msg,route,statusCode,trace_id}'` |
| Terminal | "Este é o `trace_id` do `PATCH` que fechou o diagnóstico." Aponte a linha. | |
| Terminal, log da Lambda de notificações | "O mesmo `trace_id` aparece no log da Lambda, do outro lado do SNS. A aplicação publica o `traceparent` dentro do evento, e a function o registra. Uma requisição, dois componentes, um identificador." | (volte à saída do bloco 4) |
| CloudWatch, `/aws/lambda/car-repair-shop-auth` | "E a autenticação: a Lambda de auth loga o desfecho e o `trace_id` que a aplicação devolveu no lookup. Gateway, function e aplicação, pesquisáveis pelo mesmo id." | filtre pela última invocação |
| Grafana → Explore → Loki | "No Loki, a mesma coisa, com busca." | `{service_name="car-repair-shop-api"} \| json \| trace_id="<id>"` |

### Bloco 6: Traces em execução (7:30 a 9:00)

| Tela | Fala | Comando |
|---|---|---|
| Grafana → Explore → Loki, na linha do `PATCH` | "De uma linha de log se chega ao trace: o campo `trace_id` é um link para o Tempo." | clique em **Ver trace** |
| Tempo, cascata de spans | "A requisição inteira: o span do Express, as queries do Prisma no Postgres, e o `publish` no SNS. O `trace_id` é o que está no log." | |
| Tempo → **Logs for this span** | "E o caminho de volta: do span para as linhas de log daquela requisição." | |
| Terminal | "Nada disso é configuração manual: a aplicação exporta OTLP para o Tempo, e o `traceparent` W3C atravessa HTTP e SNS." | opcional: `kubectl get cm car-repair-shop-runtime -n car-repair-shop -o jsonpath='{.data.OTEL_EXPORTER_OTLP_ENDPOINT}'` |

### Bloco 7: Dashboards e alerta (9:00 a 11:30)

Os cinco dashboards, **30 segundos cada**. Diga o que cada painel mede; não leia número.

| Dashboard | Fala |
|---|---|
| Volume de ordens de serviço | "OS abertas por dia e por hora, e a taxa de abertura. O contador subiu com a carga de antes da gravação." |
| Tempo até cada status | "Mediana, p95 e média do tempo entre a abertura da OS e cada status. O tempo de uma etapa é a diferença entre dois status vizinhos: `EXECUTION` menos `APPROVED`, por exemplo." |
| Latência, healthchecks e uptime | "p50, p95 e p99 por rota, taxa de erro 5xx, uptime dos alvos e latência das sondas." |
| Recursos do Kubernetes | "CPU e memória por pod contra request e limite, e o painel das réplicas: o HPA foi de 2 a 10 sob carga e voltou." Aponte o pico. |
| Erros e falhas nas integrações | "Falhas de integração por operação e erros 5xx por rota. É daqui que sai o alerta." |

| Tela | Fala |
|---|---|
| Alertmanager | "O alerta de falha no processamento de OS está `firing`: forcei o tópico SNS para um ARN inválido antes de gravar, e as notificações passaram a falhar. Há outros três: aplicação fora do ar, taxa de erro e latência." |

### Bloco 8: Fluxo de entrega, resultado (11:30 a 13:00)

| Tela | Fala | Comando |
|---|---|---|
| Aba Actions | "O CI passou na `main` e o CD rodou até o fim." Abra o run do CD e mostre os passos: imagem, migration, rollout, smoke. | |
| `Deployments → production` | "Cada deploy fica registrado, com a URL do gateway." | |
| Navegador em `$GW/docs` | "A nova versão está no ar: o Swagger mostra 1.1.0." | Pelo terminal: `curl -s $GW/docs/swagger-ui-init.js \| grep -o '"version": *"[^"]*"'` |
| Terminal | "E a imagem em produção é a do SHA do merge." | `kubectl get deploy car-repair-shop-api -n car-repair-shop -o jsonpath='{.spec.template.spec.containers[0].image}'` |

> **Se o CD ainda não terminou:** mostre o run em andamento, diga em qual passo está, e abra o run
> **anterior** concluído para mostrar os passos. Volte a este bloco no encerramento, se der tempo.

### Bloco 9: Encerramento (13:00 a 13:30)

| Tela | Fala |
|---|---|
| README, seção "Os quatro repositórios" | "Quatro repositórios: aplicação, banco, cluster com gateway e observabilidade, e as functions. Cada um com CI e CD." |
| README, seção "Documentação arquitetural" | "A documentação está centralizada aqui: diagrama de componentes, sequências de autenticação e de OS, modelo ER, cinco RFCs e onze ADRs. Os outros READMEs apontam para esta pasta. O usuário `soat-architecture` tem acesso aos quatro repositórios." |

---

## Tempos

| Bloco | Duração | Acumulado |
|---|---|---|
| 1. Abertura | 0:30 | 0:30 |
| 2. Entrega, início | 1:30 | 2:00 |
| 3. Autenticação por CPF e JWT | 2:00 | 4:00 |
| 4. APIs protegidas e ciclo da OS | 1:30 | 5:30 |
| 5. Logs e correlação | 2:00 | 7:30 |
| 6. Traces | 1:30 | 9:00 |
| 7. Dashboards e alerta | 2:30 | 11:30 |
| 8. Entrega, resultado | 1:30 | 13:00 |
| 9. Encerramento | 0:30 | 13:30 |

## Plano B

| Se | Então |
|---|---|
| O CD não terminou no bloco 8 | Mostre o run em andamento e o anterior concluído; volte no fim |
| O `POST /auth/cpf` devolve 401 para um CPF cadastrado | A rota de lookup não está no gateway. Não insista na câmera: use o token de `admin` para as rotas de OS e diga que a emissão será mostrada no CloudWatch da Lambda, com um run anterior |
| O port-forward do Grafana caiu | `kubectl port-forward -n observability svc/kube-prometheus-stack-grafana 3000:80` num terminal à parte, antes de gravar, e deixe rodando |
| O alerta voltou para `inactive` | Gere mais 10 transições de status; ele volta a `firing` em ~1 min |
| O trace não aparece no Tempo | Confira `kubectl get pods -n observability`: `tempo-0` em `CrashLoopBackOff` é o caso comum. Mostre o log com `trace_id` e explique que o coletor caiu; não deixe a tela vazia |
| Estourou 14:00 | Pule o bloco 8 e feche com o encerramento; a execução da pipeline já foi mostrada no bloco 2 |

## Depois de gravar

1. Restaurar o tópico SNS (passo 3 do checklist, item 4).
2. Derrubar o ambiente pela seção "Descida" do runbook.
3. Publicar o vídeo (YouTube ou Vimeo, público ou não listado, até 15 minutos).
4. Trocar `_a publicar_` no README pela URL, e registrar a URL do gateway usada na gravação com a
   data, mesmo sabendo que ela já não responde.
