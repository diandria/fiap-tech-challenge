import { ICustomerRepository } from '../../../domain/ports/ICustomerRepository';
import { Customer } from '../../../domain/entities/Customer';

export class ListCustomersUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(): Promise<Customer[]> {
    return this.repo.findAll();
  }
}
