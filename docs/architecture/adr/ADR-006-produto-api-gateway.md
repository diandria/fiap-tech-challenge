# ADR-006 (AWS API Gateway HTTP API como implementação)

- **Status:** Aceito
- **Data:** 2026-08-28
- **RFC de origem:** RFC-004

## Contexto

A RFC-004 comparou quatro produtos e recomendou um. Este ADR fixa a decisão e registra as consequências
permanentes de conviver com ela. A decisão de padrão, se deve haver um ponto único de entrada, é do
ADR-001.

## Decisão

AWS API Gateway na versão HTTP API (v2), com integração `AWS_PROXY` para a Lambda de autenticação e
integração `HTTP_PROXY` via VPC Link para o Network Load Balancer interno do cluster EKS.

## Por que vence

Resumindo o argumento da RFC-004: a Lambda de autenticação vive fora do cluster e não tem endereço nele.
Das quatro alternativas avaliadas, só as duas do API Gateway alcançam a Lambda sem inventar um caminho
paralelo. Kong e Traefik ainda competiriam por memória com a aplicação e com a stack de observabilidade,
num node group dimensionado no limite.

## Consequências

Positivas:

- Lambda e aplicação atrás do mesmo host e do mesmo esquema de CORS
- Vazão controlada na borda, antes de qualquer recurso do cluster ser consumido
- O API Gateway é gerenciado, então não ocupa memória do node group
- Ciclo de vida independente do cluster: recriar um não invalida o outro

Negativas:

- Acoplamento à AWS. `aws_apigatewayv2_route`, as integrações e o VPC Link são recursos específicos do
  provedor, e migrar para outra nuvem exige reescrever essa camada inteira. O Kong teria evitado isso.
- Um salto de latência entre cliente e aplicação, e outro entre o API Gateway e a Lambda
- Depuração em dois lugares. Um 502 pode nascer no API Gateway ou no pod, e o access log do stage precisa
  estar ligado no CloudWatch para distinguir.
- Sem validação de requisição na borda, então conteúdo malformado chega até a aplicação. É aceitável,
  porque a validação de domínio vive na camada de entidades e é lá que ela deve estar. Mas significa que
  requisição inválida consome recurso do cluster antes de ser recusada.

Riscos aceitos:

- O VPC Link é o recurso mais lento do gateway para criar e destruir, e entra no orçamento de tempo do
  provisionamento.
- Se a rota curinga `ANY /{proxy+}` capturar `POST /auth/cpf`, a requisição vai para o cluster e retorna
  404. O sintoma não aponta para a causa, então a precedência precisa ser verificada explicitamente
  depois do provisionamento.

Há um ponto de tensão que vale registrar. Conforme os serviços se multiplicarem, recursos que o Kong
oferece nativamente (agregação de resposta, autenticação por plugin, service discovery dinâmico) passam a
fazer falta, e no API Gateway cada um vira Terraform escrito à mão. Não é argumento para escolher
diferente agora, porque com dois destinos seria complexidade sem uso. É argumento para levar o gatilho de
revisão a sério.

## Quando revisitar

Qualquer um destes três derruba um dos pilares da escolha:

- O cluster ganhar folga de recurso
- O número de serviços crescer a ponto de a configuração de rotas virar fardo
- A autenticação deixar de ser servida por Lambda

Nesses casos, o Kong volta à mesa pela portabilidade e pelo ecossistema de plugins.
