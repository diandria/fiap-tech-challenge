import { OSStatus } from './ServiceOrder';
import { ValidationError } from './errors/AppError';

const VALID_TRANSITIONS: Record<OSStatus, OSStatus[]> = {
  RECEIVED: ['DIAGNOSIS'],
  DIAGNOSIS: ['WAITING_APPROVAL'],
  WAITING_APPROVAL: ['APPROVED', 'REJECTED'],
  // EXECUTION stays reachable from APPROVED while the manual flow is still in
  // use; the saga goes through PAID, and the direct path leaves at the cutover.
  APPROVED: ['EXECUTION', 'PAID', 'CANCELLED'],
  PAID: ['EXECUTION'],
  EXECUTION: ['FINISHED'],
  FINISHED: ['DELIVERED'],
  DELIVERED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransition(from: OSStatus, to: OSStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: OSStatus, to: OSStatus): void {
  if (!canTransition(from, to)) {
    throw new ValidationError(`Cannot transition from ${from} to ${to}`);
  }
}
