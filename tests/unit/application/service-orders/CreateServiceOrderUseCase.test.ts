import { CreateServiceOrderUseCase } from '../../../../src/use-cases/service-orders/CreateServiceOrderUseCase';
import { makeOSRepo, receivedOS } from '../../fixtures/serviceOrder';
import { makeServiceRepo, baseService } from '../../fixtures/service';
import { makeItemRepo, stockedItem, depletedItem } from '../../fixtures/item';
import { makeUnitOfWork } from '../../fixtures/unitOfWork';

describe('CreateServiceOrderUseCase', () => {
  describe('without services and items', () => {
    it('GIVEN valid customerId and vehicleId WHEN execute called without services or items THEN creates OS with RECEIVED status and empty arrays', async () => {
      const osRepo = makeOSRepo(receivedOS);
      const useCase = new CreateServiceOrderUseCase(makeUnitOfWork(osRepo, makeItemRepo()), makeServiceRepo());

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
      const useCase = new CreateServiceOrderUseCase(makeUnitOfWork(osRepo, makeItemRepo()), serviceRepo);

      const result = await useCase.execute({ customerId: 'c-1', vehicleId: 'v-1', services: ['s-1'] });

      expect(serviceRepo.findById).toHaveBeenCalledWith('s-1');
      expect(osRepo.create).toHaveBeenCalledWith(expect.objectContaining({ services: [{ serviceId: 's-1' }] }));
      expect(result.services).toHaveLength(1);
    });

    it('GIVEN non-existent serviceId WHEN execute called THEN throws NotFoundError before opening the unit of work', async () => {
      const osRepo = makeOSRepo(receivedOS);
      const unitOfWork = makeUnitOfWork(osRepo, makeItemRepo());
      const useCase = new CreateServiceOrderUseCase(unitOfWork, makeServiceRepo(null));

      await expect(
        useCase.execute({ customerId: 'c-1', vehicleId: 'v-1', services: ['s-inexistente'] }),
      ).rejects.toThrow('Service s-inexistente');

      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(osRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('items on creation', () => {
    it('GIVEN valid itemId with sufficient stock WHEN execute called with items array THEN reserves stock and includes item in OS', async () => {
      const osRepo = makeOSRepo({ ...receivedOS, items: [{ itemId: 'i-1', quantity: 2 }] });
      const itemRepo = makeItemRepo(stockedItem);
      const useCase = new CreateServiceOrderUseCase(makeUnitOfWork(osRepo, itemRepo), makeServiceRepo());

      const result = await useCase.execute({ customerId: 'c-1', vehicleId: 'v-1', items: [{ itemId: 'i-1', quantity: 2 }] });

      expect(itemRepo.findById).toHaveBeenCalledWith('i-1');
      expect(itemRepo.update).toHaveBeenCalledWith('i-1', { reservedQuantity: 2 });
      expect(osRepo.create).toHaveBeenCalledWith(expect.objectContaining({ items: [{ itemId: 'i-1', quantity: 2 }] }));
      expect(result.items).toHaveLength(1);
    });

    it('GIVEN non-existent itemId WHEN execute called THEN throws NotFoundError and does not create OS', async () => {
      const osRepo = makeOSRepo(receivedOS);
      const useCase = new CreateServiceOrderUseCase(makeUnitOfWork(osRepo, makeItemRepo(null)), makeServiceRepo());

      await expect(
        useCase.execute({ customerId: 'c-1', vehicleId: 'v-1', items: [{ itemId: 'i-inexistente', quantity: 1 }] }),
      ).rejects.toThrow('Item i-inexistente');

      expect(osRepo.create).not.toHaveBeenCalled();
    });

    it('GIVEN item with no available stock WHEN execute called THEN throws ValidationError and does not create OS', async () => {
      const osRepo = makeOSRepo(receivedOS);
      const useCase = new CreateServiceOrderUseCase(makeUnitOfWork(osRepo, makeItemRepo(depletedItem)), makeServiceRepo());

      await expect(
        useCase.execute({ customerId: 'c-1', vehicleId: 'v-1', items: [{ itemId: 'i-1', quantity: 1 }] }),
      ).rejects.toThrow('Insufficient stock');

      expect(osRepo.create).not.toHaveBeenCalled();
    });

    it('GIVEN first item valid and second item with no stock WHEN execute called THEN the failure leaves the unit of work so the first reservation is rolled back with it', async () => {
      const osRepo = makeOSRepo(receivedOS);
      const itemRepo = {
        ...makeItemRepo(stockedItem),
        findById: jest.fn().mockResolvedValueOnce(stockedItem).mockResolvedValueOnce(depletedItem),
      };
      const unitOfWork = makeUnitOfWork(osRepo, itemRepo);
      const useCase = new CreateServiceOrderUseCase(unitOfWork, makeServiceRepo());

      const execution = useCase.execute({
        customerId: 'c-1', vehicleId: 'v-1',
        items: [{ itemId: 'i-1', quantity: 1 }, { itemId: 'i-2', quantity: 1 }],
      });

      await expect(execution).rejects.toThrow('Insufficient stock');
      await expect(unitOfWork.run.mock.results[0].value).rejects.toThrow('Insufficient stock');
      expect(osRepo.create).not.toHaveBeenCalled();
    });

    it('GIVEN the order insert fails after reserving WHEN execute called THEN the failure leaves the unit of work', async () => {
      const osRepo = makeOSRepo(receivedOS);
      (osRepo.create as jest.Mock).mockRejectedValue(new Error('foreign key violation'));
      const unitOfWork = makeUnitOfWork(osRepo, makeItemRepo(stockedItem));
      const useCase = new CreateServiceOrderUseCase(unitOfWork, makeServiceRepo());

      const execution = useCase.execute({ customerId: 'c-1', vehicleId: 'v-missing', items: [{ itemId: 'i-1', quantity: 1 }] });

      await expect(execution).rejects.toThrow('foreign key violation');
      await expect(unitOfWork.run.mock.results[0].value).rejects.toThrow('foreign key violation');
    });
  });

  describe('resolved data passed to osRepo', () => {
    it('GIVEN valid services and items WHEN execute called THEN passes resolved arrays to osRepo.create', async () => {
      const osRepo = makeOSRepo(receivedOS);
      const useCase = new CreateServiceOrderUseCase(makeUnitOfWork(osRepo, makeItemRepo(stockedItem)), makeServiceRepo(baseService));

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
