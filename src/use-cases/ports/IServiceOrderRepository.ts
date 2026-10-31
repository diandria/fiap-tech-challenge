import { ServiceOrder, OSStatus } from '../../entities/ServiceOrder';
import { ServiceOrderStatusChange } from '../../entities/ServiceOrderStatusChange';

export interface ListServiceOrdersFilter {
  status?: OSStatus;
  customerId?: string;
  from?: Date;
  to?: Date;
  excludeStatuses?: OSStatus[];
}

export interface AvgExecutionResult {
  serviceId: string;
  avgMinutes: number;
  count: number;
}

export interface UpdateServiceOrderOptions {
  /**
   * The version the caller read. When another write got there first, the
   * update throws ConflictError instead of overwriting it.
   */
  expectedVersion?: number;
}

export interface IServiceOrderRepository {
  findAll(filter?: ListServiceOrdersFilter): Promise<ServiceOrder[]>;
  findById(id: string): Promise<ServiceOrder | null>;
  create(data: Omit<ServiceOrder, 'id' | 'createdAt' | 'version'>): Promise<ServiceOrder>;
  update(
    id: string,
    data: Partial<Omit<ServiceOrder, 'id' | 'version'>>,
    options?: UpdateServiceOrderOptions,
  ): Promise<ServiceOrder | null>;
  getAvgExecutionByService(): Promise<AvgExecutionResult[]>;
  /** Status changes of the order, oldest first. */
  findStatusHistory(serviceOrderId: string): Promise<ServiceOrderStatusChange[]>;
}
