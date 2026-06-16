import { CreateServiceOrderUseCase } from '../../../../src/use-cases/service-orders/CreateServiceOrderUseCase';
import { makeOSRepo, receivedOS } from '../../fixtures/serviceOrder';
import { makeServiceRepo, baseService } from '../../fixtures/service';
import { makeItemRepo, stockedItem, depletedItem } from '../../fixtures/item';

describe('CreateServiceOrderUseCase', () => {
  describe('baseline sem serviços e itens', () => {
    it('cria OS com RECEIVED e arrays vazios quando services e items omitidos', async () => {
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

  describe('serviços na abertura (T3)', () => {
    it('valida existência de cada serviceId e inclui na OS', async () => {
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

    it('lança NotFoundError quando serviceId não existe', async () => {
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

  describe('itens na abertura (T4)', () => {
    it('valida existência, verifica disponibilidade e reserva estoque', async () => {
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

    it('lança NotFoundError quando itemId não existe', async () => {
      const osRepo = makeOSRepo(receivedOS);
      const serviceRepo = makeServiceRepo();
      const itemRepo = makeItemRepo(null);
      const useCase = new CreateServiceOrderUseCase(osRepo, serviceRepo, itemRepo);

      await expect(
        useCase.execute({ customerId: 'c-1', vehicleId: 'v-1', items: [{ itemId: 'i-inexistente', quantity: 1 }] })
      ).rejects.toThrow('Item i-inexistente');

      expect(osRepo.create).not.toHaveBeenCalled();
    });

    it('lança ValidationError quando estoque insuficiente', async () => {
      const osRepo = makeOSRepo(receivedOS);
      const serviceRepo = makeServiceRepo();
      const itemRepo = makeItemRepo(depletedItem);
      const useCase = new CreateServiceOrderUseCase(osRepo, serviceRepo, itemRepo);

      await expect(
        useCase.execute({ customerId: 'c-1', vehicleId: 'v-1', items: [{ itemId: 'i-1', quantity: 1 }] })
      ).rejects.toThrow('Insufficient stock');

      expect(osRepo.create).not.toHaveBeenCalled();
    });

    it('faz rollback das reservas anteriores quando item subsequente falha', async () => {
      const osRepo = makeOSRepo(receivedOS);
      const serviceRepo = makeServiceRepo();

      const stockedItemRepo = {
        ...makeItemRepo(stockedItem),
        findById: jest.fn()
          .mockResolvedValueOnce(stockedItem)
          .mockResolvedValueOnce(depletedItem)
          .mockResolvedValue(stockedItem),
      };

      const useCase = new CreateServiceOrderUseCase(osRepo, serviceRepo, stockedItemRepo);

      await expect(
        useCase.execute({
          customerId: 'c-1', vehicleId: 'v-1',
          items: [
            { itemId: 'i-1', quantity: 1 },
            { itemId: 'i-2', quantity: 1 },
          ],
        })
      ).rejects.toThrow('Insufficient stock');

      expect(stockedItemRepo.update).toHaveBeenCalledWith('i-1', expect.objectContaining({
        reservedQuantity: expect.any(Number),
      }));
      expect(osRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('T5 — dados resolvidos passados ao osRepo.create()', () => {
    it('passa services e items resolvidos ao osRepo.create quando ambos fornecidos', async () => {
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
