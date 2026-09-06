import { ServiceOrder } from '../../../entities/ServiceOrder';

export interface DecideBudgetInput {
  osId: string;
  /** Confirmacao do cliente: os primeiros digitos do CPF/CNPJ. */
  code: string;
  /**
   * Filled from the token's `sub` when the decision comes from a customer.
   * Absent on an employee call.
   */
  requesterCustomerId?: string;
}

/**
 * Budget approval and rejection. Separate from IChangeServiceOrderStatus
 * because of the confirmation code. The input is a named object so that
 * `osId` and `code` cannot be swapped silently.
 */
export interface IDecideBudget {
  execute(input: DecideBudgetInput): Promise<ServiceOrder>;
}
