# ADR-011 (Como a function alcança o endpoint interno de lookup)

- **Status:** Aceito
- **Data:** 2026-08-30
- **RFC de origem:** RFC-003
- **Relacionado:** [ADR-002](ADR-002-function-emissora-de-token.md), [ADR-008](ADR-008-escopo-autenticacao-cliente.md)
- **Supersede:** a restrição do plano do M7, *"o endpoint interno de lookup não é exposto no API Gateway"*

## Contexto

O ADR-002 decidiu que a function apenas assina o JWT, e consome a validação de CPF e a consulta de
cliente da aplicação, pelo endpoint interno `POST /auth/customers/lookup`.

O plano do M7 acrescentou uma restrição: esse endpoint **não** seria exposto no API Gateway. Ela foi
implementada enumerando as rotas do gateway, em vez de usar um curinga — o que não estivesse na
lista devolveria 404 sem alcançar o cluster.

As duas decisões são corretas isoladamente e **incompatíveis juntas**. A function não tem
`vpc_config`, também por decisão do ADR-002. Sem estar na VPC, o único caminho dela até a aplicação
é o próprio gateway. E o gateway não roteava o lookup.

## Como o problema apareceu

`POST /auth/cpf` com um CPF válido e cadastrado devolvia `401 authentication failed`.

A cadeia: o gateway devolve 404 para a rota não enumerada; `HttpCustomerLookup` traduz 404 para
`not-found`; o handler traduz `not-found` para 401 genérico — que é o comportamento correto dele,
porque distinguir "não existe" de "existe mas falhou" transformaria a rota num oráculo de
enumeração.

O resultado é o pior tipo de falha: **um erro de roteamento disfarçado de credencial inválida**.
Plausível o bastante para ninguém investigar.

## Alternativas

| Alternativa | A favor | Contra |
|---|---|---|
| Rota no gateway, protegida pelo `x-internal-token` | Uma rota de Terraform. Mantém a function pequena, sem ENI e sem cold start. O modelo de proteção já está aceito no ADR-002 | O endpoint fica alcançável da internet. A única barreira é um segredo compartilhado |
| Colocar a function na VPC, chamando o NLB interno | O lookup fica genuinamente inalcançável de fora | Contradiz o ADR-002. Custa ENI, security group e cold start. Acopla a function à topologia de rede do cluster |
| Segundo gateway, privado, só para tráfego interno | Separa claramente o que é público do que é interno | Custo e complexidade desproporcionais ao escopo, para um único endpoint |
| Duplicar a regra de CPF dentro da function | Elimina o salto de rede | Já recusada no ADR-002: cria uma segunda verdade que diverge no primeiro ajuste |

## Decisão

O endpoint **passa a ter rota no API Gateway**, com throttling próprio (5 req/s, rajada 10), separada
da lista de rotas públicas.

A restrição do M7 fica **superseded** por este ADR.

## Por que vence

O critério que decide é **qual das duas afirmações já tinha sido pesada**.

O ADR-002 registra, na seção de riscos aceitos:

> "O endpoint interno é protegido pelo header `x-internal-token`, um segredo compartilhado, e não por
> mTLS. É proporcional ao escopo, mas fica registrado como dívida."

A superfície que esta rota cria é exatamente essa, e já tinha sido julgada proporcional. **A
restrição do M7 era mais estrita que o ADR que ela deveria implementar** — foi escrita supondo que a
function alcançaria a aplicação por outro caminho, e esse caminho nunca existiu.

Colocar a function na VPC é estritamente mais seguro, e é por isso que fica registrado como o
caminho de endurecimento. Mas custa ENI, security group, cold start e a contradição de um ADR
aceito, para endurecer algo que já foi julgado proporcional. Numa Fase com escopo definido, pagar
esse preço agora seria otimizar a decisão errada.

## Camadas de proteção

Nenhuma delas é suficiente sozinha; juntas são proporcionais ao dado exposto:

1. **`x-internal-token`**, comparado com `timingSafeEqual`. Com `===`, o tempo de resposta variaria
   conforme os caracteres iniciais coincidentes, e o segredo seria descoberto caractere a caractere
2. **Throttling na rota do gateway** — 5 req/s. Com o segredo comprometido, é o que separa uma
   consulta pontual de uma varredura de CPFs
3. **Rate limit na aplicação** — 30/min
4. **Ausente do Swagger público**, com teste afirmando que a spec gerada não contém a rota
5. **O corpo devolve só `{ id, name, active }`** — sem e-mail, telefone ou documento, com teste
   fixando as chaves exatas

## Consequências

Positivas:

- A autenticação de cliente passa a funcionar fim a fim
- A function continua pequena, sem ENI e sem cold start, e testável inteira com um mock de `fetch`
- A rota tem teto próprio, mais restritivo que qualquer outra do gateway

Negativas:

- O endpoint interno é alcançável da internet. Quem tiver o segredo consegue verificar se um CPF é
  cliente da oficina
- O segredo precisa bater entre o SSM e a aplicação. Divergência causa 401 sem mensagem útil
- A rota fica fora de `var.public_routes`, o que exige que quem mexer no gateway perceba que existem
  dois lugares definindo rotas

Riscos aceitos:

- O `x-internal-token` não rotaciona automaticamente. Rotação é manual, via SSM e redeploy

## Quando revisitar

Se o endpoint passar a devolver mais que `{ id, name, active }`, ou se surgir um segundo consumidor
interno, o custo da VPC deixa de ser desproporcional e a alternativa descartada aqui vira a escolha
certa. O mesmo vale se a auditoria da fase exigir que nenhum endpoint interno seja alcançável de
fora — a mudança é acrescentar `vpc_config` e trocar `APP_BASE_URL` pelo DNS do NLB interno.
