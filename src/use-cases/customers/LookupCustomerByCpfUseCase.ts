import { ICustomerRepository } from '../ports/ICustomerRepository';
import { validateCPF } from '../../entities/validators';
import { ValidationError, NotFoundError } from '../../entities/errors/AppError';

export interface CustomerLookupResult {
  id: string;
  name: string;
  active: boolean;
}

/**
 * Consulta usada pela function emissora de token (ADR-002).
 *
 * Devolve apenas o minimo que a function precisa para decidir: quem e o cliente
 * e se ele pode autenticar. E-mail, telefone e documento nao saem daqui porque
 * a function nao os usa, e dado que nao trafega nao vaza.
 */
export class LookupCustomerByCpfUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(cpf: string): Promise<CustomerLookupResult> {
    const normalized = String(cpf ?? '').replace(/\D/g, '');
    if (!validateCPF(normalized)) {
      throw new ValidationError('Invalid CPF');
    }

    // Inclui inativos de proposito: um cliente removido precisa devolver
    // `active: false`, e nao 404. A distincao importa porque a function
    // responde 403 a um cadastro desativado e 401 a um CPF desconhecido --
    // desfechos diferentes que mereciam causas diferentes.
    const customer = await this.repo.findByTaxIdIncludingInactive(normalized);
    if (!customer) throw new NotFoundError('Customer');

    return { id: customer.id, name: customer.name, active: customer.deletedAt == null };
  }
}
