# RFC-003 (Estratégia de autenticação)

- **Status:** Aceita
- **Data:** 2026-08-28
- **ADRs derivados:** ADR-002, ADR-008

## Contexto

O sistema tem dois atores que precisam ser identificados de formas bem diferentes.

Funcionários (atendente, mecânico e administrador) já autenticam com e-mail e senha, e operam com
papéis que definem o que cada um pode fazer. São pessoas com vínculo, credencial atribuída e permissões
que mudam conforme a função.

Clientes não têm cadastro de acesso. Recebem um link por e-mail quando o orçamento fica pronto, e
precisam consultar o andamento e decidir sobre o orçamento. O único dado que eles têm e que o sistema já
conhece é o CPF.

A pergunta é como identificar o cliente sem criar para ele um cadastro de acesso que ninguém vai querer
manter. E se isso substitui ou convive com a autenticação de funcionários.

## Alternativas avaliadas

### Serviço gerenciado de identidade

A favor: fluxos de recuperação de senha, verificação de e-mail e tokens padronizados já prontos. Escala
sem operação.

Contra: autenticação por CPF sem senha não cabe nos fluxos padrão. Exigiria um gatilho customizado, o
que traz a complexidade do serviço sem eliminar a função serverless. A criação de recursos de identidade
também esbarra na restrição de permissões herdada da RFC-001. E o modelo de papéis dos funcionários
teria de ser remodelado em grupos, reescrevendo o que já funciona.

### Token assinado pela própria aplicação

A favor: o caminho mais curto. A aplicação já emite token para funcionários e passaria a emitir para
clientes também. Nenhum componente novo.

Contra: não haveria componente serverless no fluxo de autenticação. E a emissão de token disputaria
recurso com o atendimento das requisições de negócio, que tem perfil de carga completamente diferente.

### Token assinado por função serverless

A favor: separa o caminho de autenticação do de negócio, então os dois escalam e são implantados de
forma independente. A função é pequena e tem uma responsabilidade só. Convive com a autenticação de
funcionários sem tocá-la.

Contra: um componente a mais para provisionar e observar. Introduz um salto de rede na autenticação, e o
segredo de assinatura passa a existir em dois lugares.

## Critérios de decisão

| Critério | Por que pesa |
|---|---|
| Encaixe no fluxo real do cliente | Ele não tem senha nem quer criar uma, e o link chega por e-mail |
| Preservação do que já funciona | O modelo de papéis dos funcionários está implementado e correto |
| Independência de escala e implantação | Autenticação e negócio têm perfis de carga distintos |
| Restrições de identidade do provedor | Herdadas da RFC-001 |

## Recomendação

Token assinado emitido por função serverless, convivendo com a autenticação de funcionários.

Os dois modelos coexistem porque os atores são diferentes, não porque faltou padronizar. O CPF
identifica alguém que o sistema já conhece como cliente. E-mail e senha identificam alguém com vínculo e
permissões. Unificar num mecanismo só forçaria um dos lados a um fluxo que não é o dele.

O serviço gerenciado de identidade perde porque resolveria bem um problema que não temos (gestão de
credenciais de cliente) e resolveria mal o que temos (identificação sem senha). A emissão pela própria
aplicação perde por juntar o caminho de autenticação ao de negócio, que é exatamente o que a separação
em função existe para evitar.

## Contrato do token de cliente

Esta seção é consumida pela implementação da função emissora e pelo middleware de autenticação da
aplicação. Precisa ser precisa o bastante para que os dois lados sejam construídos por pessoas
diferentes, sem conversa adicional.

```json
{
  "sub": "<identificador do cliente>",
  "type": "customer",
  "cpf": "<somente dígitos>",
  "name": "<nome do cliente>",
  "iat": 1700000000,
  "exp": 1700003600,
  "iss": "car-repair-shop-auth-lambda"
}
```

O token de funcionário mantém o formato atual e ganha `type: "staff"`. A informação de tipo é o que
distingue os dois emissores, e é sobre ela que o middleware decide.

Tokens emitidos antes desta mudança, sem essa informação, são tratados como de funcionário. É uma
compatibilidade necessária para que a suíte de testes existente continue valendo.

## Consequências

Positivas:

- O cliente autentica com o que já tem, sem cadastro novo
- O modelo de papéis dos funcionários fica intocado
- Autenticação e negócio escalam e são implantados de forma independente
- Token autocontido, que qualquer serviço futuro valida sem chamada extra

Negativas:

- O segredo de assinatura existe em dois componentes e precisa ser mantido igual. Se divergirem, a
  autenticação falha sem mensagem útil.
- Um salto de rede a mais na autenticação
- Dois fluxos de autenticação para documentar e testar

Riscos aceitos:

- Segredo compartilhado por variável de ambiente. O caminho correto seria par de chaves assimétrico,
  com a aplicação expondo as chaves públicas e a função assinando com a privada. Assim a função não
  precisaria conhecer segredo nenhum. Fica fora de escopo aqui, mas registrado, porque é a evolução
  natural desta decisão.
- Autenticar não é autorizar. O token prova quem a pessoa é, mas não prova que ela pode agir sobre um
  recurso específico. Essa segunda garantia está no ADR-008.
