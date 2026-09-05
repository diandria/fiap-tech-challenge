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

    // Includes inactive records on purpose: a removed customer comes back as
    // `active: false`, not a 404, so the function can answer 403 rather than 401.
    const customer = await this.repo.findByTaxIdIncludingInactive(normalized);
    if (!customer) throw new NotFoundError('Customer');

    return { id: customer.id, name: customer.name, active: customer.deletedAt == null };
  }
}
