import { ICustomerRepository } from '../../../use-cases/ports/ICustomerRepository';
import { Customer } from '../../../entities/Customer';

export class ListCustomersUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(): Promise<Customer[]> {
    return this.repo.findAll();
  }
}
