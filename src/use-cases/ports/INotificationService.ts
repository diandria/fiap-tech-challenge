import { Customer } from '../../entities/Customer';
import { ServiceOrder } from '../../entities/ServiceOrder';

export interface INotificationService {
  notifyStatusChanged(customer: Customer, os: ServiceOrder): Promise<void>;
  notifyBudgetReady(customer: Customer, os: ServiceOrder): Promise<void>;
}
