import { ListServiceOrdersUseCase } from '../../../../src/use-cases/service-orders/ListServiceOrdersUseCase';
import { ServiceOrder } from '../../../../src/entities/ServiceOrder';

function makeOS(overrides: Partial<ServiceOrder> = {}): ServiceOrder {
  return {
    id: 'os-1',
    customerId: 'c-1',
    vehicleId: 'v-1',
    status: 'RECEIVED',
    services: [],
    items: [],
    createdAt: new Date('2024-01-01T10:00:00Z'),
    ...overrides,
  } as ServiceOrder;
}

function makeRepo(orders: ServiceOrder[]) {
  return { findAll: jest.fn().mockResolvedValue(orders) } as any;
}

describe('ListServiceOrdersUseCase', () => {
  describe('default exclusion of terminal statuses', () => {
    it('GIVEN no status filter WHEN execute called THEN passes excludeStatuses=[FINISHED,DELIVERED] to repo', async () => {
      const repo = makeRepo([]);
      const useCase = new ListServiceOrdersUseCase(repo);
      await useCase.execute();
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ excludeStatuses: ['FINISHED', 'DELIVERED'] }),
      );
    });

    it('GIVEN no status filter WHEN execute called THEN does not pass status to repo', async () => {
      const repo = makeRepo([]);
      const useCase = new ListServiceOrdersUseCase(repo);
      await useCase.execute();
      const calledWith = repo.findAll.mock.calls[0][0];
      expect(calledWith.status).toBeUndefined();
    });

    it('GIVEN explicit status filter WHEN execute called THEN does not pass excludeStatuses to repo', async () => {
      const repo = makeRepo([]);
      const useCase = new ListServiceOrdersUseCase(repo);
      await useCase.execute({ status: 'FINISHED' });
      const calledWith = repo.findAll.mock.calls[0][0];
      expect(calledWith.excludeStatuses).toBeUndefined();
    });

    it('GIVEN explicit status filter WHEN execute called THEN passes status to repo', async () => {
      const repo = makeRepo([]);
      const useCase = new ListServiceOrdersUseCase(repo);
      await useCase.execute({ status: 'FINISHED' });
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FINISHED' }),
      );
    });
  });

  describe('priority sort', () => {
    it('GIVEN EXECUTION and WAITING_APPROVAL orders WHEN execute called THEN EXECUTION comes first', async () => {
      const orders = [
        makeOS({ id: 'os-1', status: 'WAITING_APPROVAL' }),
        makeOS({ id: 'os-2', status: 'EXECUTION' }),
      ];
      const repo = makeRepo(orders);
      const useCase = new ListServiceOrdersUseCase(repo);
      const result = await useCase.execute({ status: 'EXECUTION' });
      expect(result[0].status).toBe('EXECUTION');
    });

    it('GIVEN orders in all active statuses WHEN execute called THEN sorted EXECUTION>WAITING_APPROVAL>DIAGNOSIS>RECEIVED', async () => {
      const orders = [
        makeOS({ id: 'os-4', status: 'RECEIVED', createdAt: new Date('2024-01-01') }),
        makeOS({ id: 'os-3', status: 'DIAGNOSIS', createdAt: new Date('2024-01-02') }),
        makeOS({ id: 'os-2', status: 'WAITING_APPROVAL', createdAt: new Date('2024-01-03') }),
        makeOS({ id: 'os-1', status: 'EXECUTION', createdAt: new Date('2024-01-04') }),
      ];
      const repo = makeRepo(orders);
      const useCase = new ListServiceOrdersUseCase(repo);
      const result = await useCase.execute({ status: 'EXECUTION' });
      expect(result.map((o) => o.status)).toEqual([
        'EXECUTION',
        'WAITING_APPROVAL',
        'DIAGNOSIS',
        'RECEIVED',
      ]);
    });

    it('GIVEN order with undefined-priority status WHEN execute called THEN placed after known statuses', async () => {
      const orders = [
        makeOS({ id: 'os-a', status: 'APPROVED' }),
        makeOS({ id: 'os-b', status: 'RECEIVED' }),
      ];
      const repo = makeRepo(orders);
      const useCase = new ListServiceOrdersUseCase(repo);
      const result = await useCase.execute({ status: 'EXECUTION' });
      expect(result[0].status).toBe('RECEIVED');
      expect(result[1].status).toBe('APPROVED');
    });

    it('GIVEN two orders with same status WHEN execute called THEN older createdAt comes first', async () => {
      const orders = [
        makeOS({ id: 'os-newer', status: 'DIAGNOSIS', createdAt: new Date('2024-01-10') }),
        makeOS({ id: 'os-older', status: 'DIAGNOSIS', createdAt: new Date('2024-01-01') }),
      ];
      const repo = makeRepo(orders);
      const useCase = new ListServiceOrdersUseCase(repo);
      const result = await useCase.execute({ status: 'EXECUTION' });
      expect(result[0].id).toBe('os-older');
      expect(result[1].id).toBe('os-newer');
    });
  });
});
