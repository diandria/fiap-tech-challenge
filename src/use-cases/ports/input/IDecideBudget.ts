import { ServiceOrder } from '../../../entities/ServiceOrder';

export interface DecideBudgetInput {
  osId: string;
  /** Confirmacao do cliente: os primeiros digitos do CPF/CNPJ. */
  code: string;
  /**
   * Preenchido a partir do `sub` do token quando quem decide e um cliente.
   * Ausente numa chamada de funcionario.
   */
  requesterCustomerId?: string;
}

/**
 * Aprovacao e recusa de orcamento.
 *
 * Separado de IChangeServiceOrderStatus por causa do codigo de confirmacao, que
 * identifica quem decidiu. Juntar os dois num port so exigiria um parametro
 * opcional que metade dos implementadores ignoraria.
 *
 * O input e objeto nomeado, e nao parametros posicionais, porque tres strings
 * em sequencia sao exatamente a forma que convida a troca silenciosa: inverter
 * `osId` e `code` compilaria sem reclamacao.
 */
export interface IDecideBudget {
  execute(input: DecideBudgetInput): Promise<ServiceOrder>;
}
