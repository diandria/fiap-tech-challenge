import { ICustomerRepository } from '../../../use-cases/ports/ICustomerRepository';
import { Customer } from '../../../entities/Customer';
import { NotFoundError } from '../../../entities/errors/AppError';

export class GetCustomerByIdUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(id: string): Promise<Customer> {
    const customer = await this.repo.findById(id);
    if (!customer) throw new NotFoundError('Customer');
    return customer;
  }
}
