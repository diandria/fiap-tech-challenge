import { Customer } from '../entities/Customer';
import { ServiceOrder } from '../entities/ServiceOrder';

export interface INotificationService {
  notifyBudgetReady(customer: Customer, os: ServiceOrder): Promise<void>;
}
