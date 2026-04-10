import { DeleteVehicleUseCase } from '../../../../src/application/use-cases/vehicles/DeleteVehicleUseCase';
import { IVehicleRepository } from '../../../../src/domain/ports/IVehicleRepository';

const makeRepo = (deleted: boolean): IVehicleRepository => ({
  findAll: jest.fn(), findById: jest.fn(), findByPlate: jest.fn(),
  create: jest.fn(), update: jest.fn(),
  delete: jest.fn().mockResolvedValue(deleted),
});

describe('DeleteVehicleUseCase', () => {
  it('deletes the vehicle successfully', async () => {
    const repo = makeRepo(true);
    const useCase = new DeleteVehicleUseCase(repo);
    await expect(useCase.execute('v-1')).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith('v-1');
  });

  it('throws NotFoundError when vehicle does not exist', async () => {
    const useCase = new DeleteVehicleUseCase(makeRepo(false));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
