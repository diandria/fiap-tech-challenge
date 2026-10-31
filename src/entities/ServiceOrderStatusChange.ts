import { OSStatus } from './ServiceOrder';

/** One status change of a service order. `from` is null for the opening. */
export interface ServiceOrderStatusChange {
  from: OSStatus | null;
  to: OSStatus;
  changedAt: Date;
}
