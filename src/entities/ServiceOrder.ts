export type OSStatus =
  | 'RECEIVED'
  | 'DIAGNOSIS'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'PAID'
  | 'EXECUTION'
  | 'FINISHED'
  | 'DELIVERED'
  | 'REJECTED'
  | 'CANCELLED';

export interface OSService {
  serviceId: string;
}

export interface OSItem {
  itemId: string;
  quantity: number;
}

export interface ServiceOrder {
  id: string;
  customerId: string;
  vehicleId: string;
  status: OSStatus;
  budgetTotal?: number;
  services: OSService[];
  items: OSItem[];
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  deliveredAt?: Date;
  /** Incremented on every write; lets an update detect that it read a stale order. */
  version: number;
}
