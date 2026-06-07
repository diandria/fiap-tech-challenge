import { ICustomerRepository } from '../../../use-cases/ports/ICustomerRepository';
import { Customer } from '../../../entities/Customer';
import { NotFoundError } from '../../../entities/errors/AppError';

export class GetCustomerByTaxIdUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(taxId: string): Promise<Customer> {
    const customer = await this.repo.findByTaxId(taxId);
    if (!customer) throw new NotFoundError('Customer');
    return customer;
  }
}
