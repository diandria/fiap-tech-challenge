import { OSStatus } from './entities/ServiceOrder';
import { ValidationError } from './errors/AppError';

const VALID_TRANSITIONS: Record<OSStatus, OSStatus[]> = {
  RECEIVED: ['DIAGNOSIS'],
  DIAGNOSIS: ['WAITING_APPROVAL'],
  WAITING_APPROVAL: ['EXECUTION', 'REJECTED'],
  EXECUTION: ['FINISHED'],
  FINISHED: ['DELIVERED'],
  DELIVERED: [],
  REJECTED: [],
};

export function canTransition(from: OSStatus, to: OSStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: OSStatus, to: OSStatus): void {
  if (!canTransition(from, to)) {
    throw new ValidationError(`Cannot transition from ${from} to ${to}`);
  }
}
