import { CreateServiceOrderUseCase } from '../../../../src/use-cases/service-orders/CreateServiceOrderUseCase';
import { makeOSRepo, receivedOS } from '../../fixtures/serviceOrder';
import { makeServiceRepo, baseService } from '../../fixtures/service';
import { makeItemRepo, stockedItem, depletedItem } from '../../fixtures/item';

describe('CreateServiceOrderUseCase', () => {
  describe('without services and items', () => {
    it('GIVEN valid customerId and vehicleId WHEN execute called without services or items THEN creates OS with RECEIVED status and empty arrays', async () => {
      const osRepo = makeOSRepo(receivedOS);
      const serviceRepo = makeServiceRepo();
      const itemRepo = makeItemRepo();
      const useCase = new CreateServiceOrderUseCase(osRepo, serviceRepo, itemRepo);

      const result = await useCase.execute({ customerId: 'c-1', vehicleId: 'v-1' });

      expect(osRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        customerId: 'c-1', vehicleId: 'v-1', status: 'RECEIVED',
        services: [], items: [],
      }));
      expect(result.status).toBe('RECEIVED');
    });
  });

  describe('services on creation', () => {
    it('GIVEN valid serviceId WHEN execute called with services array THEN validates existence and includes service in OS', async () => {
      const osRepo = makeOSRepo({ ...receivedOS, services: [{ serviceId: 's-1' }] });
      const serviceRepo = makeServiceRepo(baseService);
      const itemRepo = makeItemRepo();
      const useCase = new CreateServiceOrderUseCase(osRepo, serviceRepo, itemRepo);

      const result = await useCase.execute({
        customerId: 'c-1', vehicleId: 'v-1',
        services: ['s-1'],
      });

      expect(serviceRepo.findById).toHaveBeenCalledWith('s-1');
      expect(osRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        services: [{ serviceId: 's-1' }],
      }));
      expect(result.services).toHaveLength(1);
    });

    it('GIVEN non-existent serviceId WHEN execute called THEN throws NotFoundError and does not create OS', async () => {
      const osRepo = makeOSRepo(receivedOS);
      const serviceRepo = makeServiceRepo(null);
      const itemRepo = makeItemRepo();
      const useCase = new CreateServiceOrderUseCase(osRepo, serviceRepo, itemRepo);

      await expect(
        useCase.execute({ customerId: 'c-1', vehicleId: 'v-1', services: ['s-inexistente'] })
      ).rejects.toThrow('Service s-inexistente');

      expect(osRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('items on creation', () => {
    it('GIVEN valid itemId with sufficient stock WHEN execute called with items array THEN reserves stock and includes item in OS', async () => {
      const osRepo = makeOSRepo({ ...receivedOS, items: [{ itemId: 'i-1', quantity: 2 }] });
      const serviceRepo = makeServiceRepo();
      const itemRepo = makeItemRepo(stockedItem);
      const useCase = new CreateServiceOrderUseCase(osRepo, serviceRepo, itemRepo);

      const result = await useCase.execute({
        customerId: 'c-1', vehicleId: 'v-1',
        items: [{ itemId: 'i-1', quantity: 2 }],
      });

      expect(itemRepo.findById).toHaveBeenCalledWith('i-1');
      expect(itemRepo.update).toHaveBeenCalledWith('i-1', { reservedQuantity: 2 });
      expect(osRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        items: [{ itemId: 'i-1', quantity: 2 }],
      }));
      expect(result.items).toHaveLength(1);
    });

    it('GIVEN non-existent itemId WHEN execute called THEN throws NotFoundError and does not create OS', async () => {
      const osRepo = makeOSRepo(receivedOS);
      const serviceRepo = makeServiceRepo();
      const itemRepo = makeItemRepo(null);
      const useCase = new CreateServiceOrderUseCase(osRepo, serviceRepo, itemRepo);

      await expect(
        useCase.execute({ customerId: 'c-1', vehicleId: 'v-1', items: [{ itemId: 'i-inexistente', quantity: 1 }] })
      ).rejects.toThrow('Item i-inexistente');

      expect(osRepo.create).not.toHaveBeenCalled();
    });

    it('GIVEN item with no available stock WHEN execute called THEN throws ValidationError and does not create OS', async () => {
      const osRepo = makeOSRepo(receivedOS);
      const serviceRepo = makeServiceRepo();
      const itemRepo = makeItemRepo(depletedItem);
      const useCase = new CreateServiceOrderUseCase(osRepo, serviceRepo, itemRepo);

      await expect(
        useCase.execute({ customerId: 'c-1', vehicleId: 'v-1', items: [{ itemId: 'i-1', quantity: 1 }] })
      ).rejects.toThrow('Insufficient stock');

      expect(osRepo.create).not.toHaveBeenCalled();
    });

    it('GIVEN first item valid and second item with no stock WHEN execute called THEN rolls back first item reservation and does not create OS', async () => {
      const osRepo = makeOSRepo(receivedOS);
      const serviceRepo = makeServiceRepo();

      const itemRepo = {
        ...makeItemRepo(stockedItem),
        findById: jest.fn()
          .mockResolvedValueOnce(stockedItem)
          .mockResolvedValueOnce(depletedItem)
          .mockResolvedValue(stockedItem),
      };

      const useCase = new CreateServiceOrderUseCase(osRepo, serviceRepo, itemRepo);

      await expect(
        useCase.execute({
          customerId: 'c-1', vehicleId: 'v-1',
          items: [
            { itemId: 'i-1', quantity: 1 },
            { itemId: 'i-2', quantity: 1 },
          ],
        })
      ).rejects.toThrow('Insufficient stock');

      expect(itemRepo.update).toHaveBeenCalledWith('i-1', expect.objectContaining({
        reservedQuantity: expect.any(Number),
      }));
      expect(osRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('resolved data passed to osRepo', () => {
    it('GIVEN valid services and items WHEN execute called THEN passes resolved arrays to osRepo.create', async () => {
      const osRepo = makeOSRepo(receivedOS);
      const serviceRepo = makeServiceRepo(baseService);
      const itemRepo = makeItemRepo(stockedItem);
      const useCase = new CreateServiceOrderUseCase(osRepo, serviceRepo, itemRepo);

      await useCase.execute({
        customerId: 'c-1', vehicleId: 'v-1',
        services: ['s-1'],
        items: [{ itemId: 'i-1', quantity: 3 }],
      });

      expect(osRepo.create).toHaveBeenCalledWith({
        customerId: 'c-1',
        vehicleId: 'v-1',
        status: 'RECEIVED',
        services: [{ serviceId: 's-1' }],
        items: [{ itemId: 'i-1', quantity: 3 }],
      });
    });
  });
});
