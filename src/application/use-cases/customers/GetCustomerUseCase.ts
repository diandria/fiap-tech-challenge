import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { Customer } from '../../../domain/entities/Customer';
import { NotFoundError } from '../../../domain/errors/AppError';

export class GetCustomerUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(id: string): Promise<Customer> {
    const customer = await this.repo.findById(id);
    if (!customer) throw new NotFoundError('Customer');
    return customer;
  }
}
