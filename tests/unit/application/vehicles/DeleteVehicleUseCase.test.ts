import { DeleteVehicleUseCase } from '../../../../src/application/use-cases/vehicles/DeleteVehicleUseCase';
import { IVehicleRepository } from '../../../../src/domain/ports/IVehicleRepository';

const makeVehicleRepo = (deleted: boolean): IVehicleRepository => ({
  findAll: jest.fn(), findById: jest.fn(), findByPlate: jest.fn(),
  create: jest.fn(), update: jest.fn(),
  delete: jest.fn().mockResolvedValue(deleted),
});

describe('DeleteVehicleUseCase', () => {
  it('GIVEN existing vehicle WHEN delete called THEN resolves without error', async () => {
    const repo = makeVehicleRepo(true);
    const useCase = new DeleteVehicleUseCase(repo);
    await expect(useCase.execute('v-1')).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith('v-1');
  });

  it('GIVEN non-existing vehicle WHEN delete called THEN throws NotFoundError', async () => {
    const useCase = new DeleteVehicleUseCase(makeVehicleRepo(false));
    await expect(useCase.execute('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
