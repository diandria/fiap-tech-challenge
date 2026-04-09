import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { Customer } from '../../../domain/entities/Customer';
import { validateTaxId, validatePhone } from '../../../domain/validators';
import { NotFoundError, ValidationError, ConflictError } from '../../../domain/errors/AppError';

export class UpdateCustomerUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(id: string, data: Partial<Omit<Customer, 'id'>>): Promise<Customer> {
    if (data.taxType !== undefined && !['CPF', 'CNPJ'].includes(data.taxType)) {
      throw new ValidationError('taxType must be CPF or CNPJ');
    }
    if (data.phone !== undefined && !validatePhone(data.phone)) {
      throw new ValidationError('Invalid phone number');
    }
    if (data.taxId !== undefined) {
      const taxType = data.taxType ?? 'CPF';
      if (!validateTaxId(data.taxId, taxType)) throw new ValidationError('Invalid CPF or CNPJ');
      const existing = await this.repo.findByTaxId(data.taxId);
      if (existing && existing.id !== id) throw new ConflictError('CPF/CNPJ already registered');
    }
    const updated = await this.repo.update(id, data);
    if (!updated) throw new NotFoundError('Customer');
    return updated;
  }
}
