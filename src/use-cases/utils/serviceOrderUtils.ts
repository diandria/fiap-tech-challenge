import { IServiceOrderRepository } from '../ports/IServiceOrderRepository';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { Customer } from '../../entities/Customer';
import { NotFoundError, ValidationError } from '../../entities/errors/AppError';

export async function findOSOrThrow(
  repo: IServiceOrderRepository,
  osId: string,
): Promise<ServiceOrder> {
  const os = await repo.findById(osId);
  if (!os) throw new NotFoundError('Service order');
  return os;
}

export function verifyCustomerCode(customer: Customer, code: string): void {
  const expected = customer.taxId.slice(0, 4);
  if (code !== expected) throw new ValidationError('Invalid confirmation code');
}
