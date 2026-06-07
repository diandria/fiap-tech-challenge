import { ServiceOrder } from '../../../src/entities/ServiceOrder';
import { IServiceOrderRepository } from '../../../src/domain/ports/IServiceOrderRepository';

export const baseOS: ServiceOrder = {
  id: 'os-1',
  customerId: 'c-1',
  vehicleId: 'v-1',
  status: 'DIAGNOSIS',
  budgetTotal: undefined,
  services: [],
  items: [],
  createdAt: new Date('2026-01-01'),
};

export const receivedOS: ServiceOrder = { ...baseOS, status: 'RECEIVED' };

export const waitingApprovalOS: ServiceOrder = {
  ...baseOS,
  status: 'WAITING_APPROVAL',
  budgetTotal: 200,
  items: [{ itemId: 'i-1', quantity: 2 }],
};

export const approvedOS: ServiceOrder = {
  ...waitingApprovalOS,
  status: 'APPROVED',
};

export const executionOS: ServiceOrder = {
  ...baseOS,
  status: 'EXECUTION',
  services: [{ serviceId: 's-1' }],
  items: [{ itemId: 'i-1', quantity: 1 }],
  startedAt: new Date('2026-01-01T10:00:00'),
};

export const finishedOS: ServiceOrder = {
  ...executionOS,
  status: 'FINISHED',
  finishedAt: new Date('2026-01-01T12:00:00'),
};

export const makeOSRepo = (
  os: ServiceOrder | null = baseOS,
  updateResult?: ServiceOrder,
): IServiceOrderRepository => ({
  findAll: jest.fn().mockResolvedValue(os ? [os] : []),
  findById: jest.fn().mockResolvedValue(os),
  create: jest.fn().mockResolvedValue(os ?? baseOS),
  update: jest.fn().mockImplementation((_id: string, data: Partial<ServiceOrder>) =>
    Promise.resolve(updateResult ?? (os ? { ...os, ...data } : null))
  ),
  getAvgExecutionByService: jest.fn().mockResolvedValue([]),
});
