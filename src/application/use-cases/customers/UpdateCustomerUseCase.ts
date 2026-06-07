import { ICustomerRepository } from '../../../use-cases/ports/ICustomerRepository';
import { Customer } from '../../../entities/Customer';
import { validatePhone } from '../../../entities/validators';
import { NotFoundError, ValidationError } from '../../../entities/errors/AppError';

export class UpdateCustomerUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(id: string, data: Partial<Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Customer> {
    if (data.taxId !== undefined || data.taxType !== undefined) {
      throw new ValidationError('taxId and taxType cannot be updated');
    }
    if (data.phone !== undefined && !validatePhone(data.phone)) {
      throw new ValidationError('Invalid phone number');
    }
    const updated = await this.repo.update(id, data);
    if (!updated) throw new NotFoundError('Customer');
    return updated;
  }
}
