export type OSStatus =
  | 'RECEIVED'
  | 'DIAGNOSIS'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTION'
  | 'FINISHED'
  | 'DELIVERED'
  | 'REJECTED';

export interface OSService {
  serviceId: string;
  startedAt?: Date;
  finishedAt?: Date;
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
}
