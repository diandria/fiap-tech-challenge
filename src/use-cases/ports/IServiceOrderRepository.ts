import { ServiceOrder, OSStatus } from '../../entities/ServiceOrder';

export interface ListServiceOrdersFilter {
  status?: OSStatus;
  customerId?: string;
  from?: Date;
  to?: Date;
}

export interface AvgExecutionResult {
  serviceId: string;
  avgMinutes: number;
  count: number;
}

export interface IServiceOrderRepository {
  findAll(filter?: ListServiceOrdersFilter): Promise<ServiceOrder[]>;
  findById(id: string): Promise<ServiceOrder | null>;
  create(data: Omit<ServiceOrder, 'id' | 'createdAt'>): Promise<ServiceOrder>;
  update(id: string, data: Partial<Omit<ServiceOrder, 'id'>>): Promise<ServiceOrder | null>;
  getAvgExecutionByService(): Promise<AvgExecutionResult[]>;
}
