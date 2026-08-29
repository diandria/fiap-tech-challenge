# ADR-002 (AWS Lambda como emissora de token)

- **Status:** Aceito
- **Data:** 2026-08-28
- **RFC de origem:** RFC-003

## Contexto

A Lambda de autenticação precisa decidir o que faz por conta própria e o que delega. Três capacidades
estão envolvidas: validar o CPF, consultar se o cliente existe e está ativo, e emitir o JWT.

Duas delas já existem na aplicação. `validateCPF` vive em `src/entities/validators.ts`, como regra de
domínio. `GetCustomerByTaxIdUseCase` é um caso de uso implementado. A terceira, emitir o JWT de cliente,
não existe em lugar nenhum.

## Alternativas

| Alternativa | A favor | Contra |
|---|---|---|
| A Lambda faz tudo | Autossuficiente, funciona mesmo com a aplicação fora, um salto de rede a menos | Duas fontes de verdade para a regra do CPF. A Lambda precisaria do driver `pg`, de `vpc_config` e de credencial do RDS. Mudança na regra exige dois repositórios em sincronia. |
| A Lambda só assina o JWT | Uma regra, um lugar. Função pequena, sem `pg` e sem `vpc_config`. Testável inteira com um mock de `fetch`. | Depende da aplicação estar de pé. Um salto de rede a mais na autenticação. |
| A aplicação emite o próprio JWT de cliente | A mais simples de todas | Não existe componente serverless. Perde-se a separação de responsabilidade e a escalabilidade independente do caminho de autenticação. |

## Decisão

A Lambda tem responsabilidade única: assinar e devolver o JWT, com `jsonwebtoken`. Validação de CPF e
consulta de cliente ficam na aplicação, e a Lambda as consome pelo endpoint interno
`POST /auth/customers/lookup`.

## Por que vence

O critério que decide é onde mora a regra de negócio. A validação de CPF é regra de domínio da oficina e
vive na camada de entidades por decisão da Clean Architecture.

Uma cópia dela na Lambda, em outro repositório, não é redundância inofensiva. É uma segunda verdade que
vai divergir no primeiro ajuste. E a divergência aparece como "o CPF funciona no cadastro e falha no
login", que é caro de diagnosticar porque o sintoma não aponta para a causa.

O contra da opção escolhida (depender da aplicação) é real, mas barato. Se a aplicação está fora, não há
API protegida para consumir com o token de qualquer forma. A dependência já existia de fato, e a decisão
só a torna explícita.

Pensando na decomposição futura, tem outro ganho. A regra do CPF pertence ao contexto de cadastro de
clientes. Quando esse contexto virar serviço próprio, a Lambda passa a consultá-lo em vez da aplicação
monolítica, o que é mudança de `APP_BASE_URL` e não de responsabilidade. Se a regra tivesse sido copiada
para dentro da Lambda, cada extração criaria mais uma cópia a sincronizar. A fronteira desenhada aqui já
é a fronteira do serviço futuro.

## Consequências

Positivas:

- Uma regra, um lugar
- A Lambda é pequena, sem `pg` e sem `vpc_config`, e dá para testá-la inteira com um mock de `fetch`
- O caminho de autenticação escala e é implantado independentemente do de negócio

Negativas:

- A Lambda depende da disponibilidade da aplicação rodando no EKS
- Um salto de rede a mais na autenticação
- O endpoint de consulta precisa existir e ser protegido, o que é superfície nova

Riscos aceitos:

- O endpoint interno é protegido pelo header `x-internal-token`, um segredo compartilhado, e não por mTLS.
  É proporcional ao escopo, mas fica registrado como dívida.
- Uma requisição com CPF não cadastrado devolve erro genérico de credencial, não "não encontrado".
  Devolver a distinção transformaria o endpoint num oráculo de enumeração, porque daria para descobrir
  quem é cliente da oficina testando documentos.

## Quando revisitar

Se a latência do caminho de autenticação virar problema, ou se a aplicação passar a ter indisponibilidade
que afete a emissão de token. A resposta provável, ainda assim, é melhorar a disponibilidade da
aplicação, não duplicar a regra na Lambda.
