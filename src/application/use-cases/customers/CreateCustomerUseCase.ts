import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { Customer } from '../../../domain/entities/Customer';
import { validateTaxId } from '../../../domain/validators';
import { ValidationError, ConflictError } from '../../../domain/errors/AppError';

interface CreateCustomerInput {
  name: string;
  taxId: string;
  taxType: 'CPF' | 'CNPJ';
  email: string;
  phone: string;
}

const VALID_TAX_TYPES = ['CPF', 'CNPJ'] as const;

export class CreateCustomerUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(input: CreateCustomerInput): Promise<Customer> {
    if (!VALID_TAX_TYPES.includes(input.taxType)) {
      throw new ValidationError('taxType must be CPF or CNPJ');
    }
    if (!validateTaxId(input.taxId)) {
      throw new ValidationError('Invalid CPF or CNPJ');
    }
    const existing = await this.repo.findByTaxId(input.taxId);
    if (existing) throw new ConflictError('CPF/CNPJ already registered');
    return this.repo.create(input);
  }
}
