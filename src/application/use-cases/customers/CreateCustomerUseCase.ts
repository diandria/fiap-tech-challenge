import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { Customer } from '../../../domain/entities/Customer';
import { validateTaxId } from '../../../domain/validators';
import { ValidationError, ConflictError } from '../../../domain/errors/AppError';

interface CreateCustomerInput {
  name: string;
  taxId: string;
  email: string;
  phone: string;
}

export class CreateCustomerUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(input: CreateCustomerInput): Promise<Customer> {
    if (!validateTaxId(input.taxId)) {
      throw new ValidationError('Invalid CPF or CNPJ');
    }
    const existing = await this.repo.findByTaxId(input.taxId);
    if (existing) throw new ConflictError('CPF/CNPJ already registered');
    return this.repo.create(input);
  }
}
