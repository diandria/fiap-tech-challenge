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
 * Budget approval and rejection.
 *
 * Kept apart from IChangeServiceOrderStatus because of the confirmation code,
 * which identifies who decided. Merging both into one port would require an
 * optional parameter that half the implementations would ignore.
 *
 * The input is a named object, not positional parameters, because three
 * strings in a row are exactly the shape that invites a silent swap: reversing
 * `osId` and `code` would compile without complaint.
 */
export interface IDecideBudget {
  execute(input: DecideBudgetInput): Promise<ServiceOrder>;
}
