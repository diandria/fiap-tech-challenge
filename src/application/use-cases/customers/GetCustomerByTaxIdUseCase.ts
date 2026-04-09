import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { Customer } from '../../../domain/entities/Customer';
import { NotFoundError } from '../../../domain/errors/AppError';

export class GetCustomerByTaxIdUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(taxId: string): Promise<Customer> {
    const customer = await this.repo.findByTaxId(taxId);
    if (!customer) throw new NotFoundError('Customer');
    return customer;
  }
}
