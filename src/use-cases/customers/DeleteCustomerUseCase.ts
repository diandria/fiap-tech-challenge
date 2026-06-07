import { ICustomerRepository } from '../ports/ICustomerRepository';
import { NotFoundError } from '../../entities/errors/AppError';

export class DeleteCustomerUseCase {
  constructor(private readonly repo: ICustomerRepository) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.repo.softDelete(id);
    if (!deleted) throw new NotFoundError('Customer');
  }
}
