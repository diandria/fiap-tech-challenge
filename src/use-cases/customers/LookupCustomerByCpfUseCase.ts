import { ICustomerRepository } from '../ports/ICustomerRepository';
import { validateCPF } from '../../entities/validators';
import { ValidationError, NotFoundError } from '../../entities/errors/AppError';

export interface CustomerLookupResult {
  id: string;
  name: string;
  active: boolean;
}

/**
 * Lookup used by the token-issuing function (ADR-002).
 *
 * Returns only the minimum the function needs in order to decide: who the
 * customer is and whether they may authenticate. E-mail, phone and tax id do
 * not leave here because the function does not use them, and data that does not
 * travel cannot leak.
 */
export class LookupCustomerByCpfUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(cpf: string): Promise<CustomerLookupResult> {
    const normalized = String(cpf ?? '').replace(/\D/g, '');
    if (!validateCPF(normalized)) {
      throw new ValidationError('Invalid CPF');
    }

    // Includes inactive records on purpose: a removed customer must come back
    // as `active: false`, not as a 404. The distinction matters because the
    // function answers 403 to a deactivated record and 401 to an unknown tax
    // id -- different outcomes that deserved different causes.
    const customer = await this.repo.findByTaxIdIncludingInactive(normalized);
    if (!customer) throw new NotFoundError('Customer');

    return { id: customer.id, name: customer.name, active: customer.deletedAt == null };
  }
}
