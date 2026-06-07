import { ICustomerRepository } from '../../../use-cases/ports/ICustomerRepository';
import { Customer, TaxType } from '../../../entities/Customer';
import { validateTaxId, validatePhone } from '../../../entities/validators';
import { ValidationError, ConflictError } from '../../../entities/errors/AppError';

interface CreateCustomerInput {
  name: string;
  taxId: string;
  taxType: TaxType;
  email: string;
  phone: string;
}

export class CreateCustomerUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(input: CreateCustomerInput): Promise<Customer> {
    if (input.taxType !== 'CPF' && input.taxType !== 'CNPJ') {
      throw new ValidationError('taxType must be CPF or CNPJ');
    }
    if (!validatePhone(input.phone)) {
      throw new ValidationError('Invalid phone number');
    }
    const normalizedTaxId = input.taxId.replace(/\D/g, '');
    if (!validateTaxId(normalizedTaxId, input.taxType)) {
      throw new ValidationError('Invalid CPF or CNPJ');
    }
    const existing = await this.repo.findByTaxId(normalizedTaxId);
    if (existing) throw new ConflictError('CPF/CNPJ already registered');
    return this.repo.create({ ...input, taxId: normalizedTaxId });
  }
}
