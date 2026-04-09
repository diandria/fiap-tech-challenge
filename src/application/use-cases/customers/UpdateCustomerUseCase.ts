import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { Customer } from '../../../domain/entities/Customer';
import { validateCpfCnpj } from '../../../domain/validators';
import { NotFoundError, ValidationError, ConflictError } from '../../../domain/errors/AppError';

export class UpdateCustomerUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(id: string, data: Partial<Omit<Customer, 'id'>>): Promise<Customer> {
    if (data.cpfCnpj !== undefined) {
      if (!validateCpfCnpj(data.cpfCnpj)) throw new ValidationError('Invalid CPF or CNPJ');
      const existing = await this.repo.findByCpfCnpj(data.cpfCnpj);
      if (existing && existing.id !== id) throw new ConflictError('CPF/CNPJ already registered');
    }
    const updated = await this.repo.update(id, data);
    if (!updated) throw new NotFoundError('Customer');
    return updated;
  }
}
