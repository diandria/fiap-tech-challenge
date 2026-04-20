import { RegisterUseCase } from '../../../../src/application/use-cases/auth/RegisterUseCase';
import { IUserRepository } from '../../../../src/domain/ports/IUserRepository';

const makeRepo = (existing: any = null): IUserRepository => ({
  findByEmail: jest.fn().mockResolvedValue(existing),
  findById: jest.fn(),
  create: jest.fn().mockResolvedValue({
    id: 'u-1', email: 'a@b.com', passwordHash: 'hashed', role: 'attendant',
  }),
});

describe('RegisterUseCase', () => {
  it('GIVEN new email WHEN register called THEN creates user and returns id and role', async () => {
    const repo = makeRepo(null);
    const useCase = new RegisterUseCase(repo);
    const result = await useCase.execute({ email: 'a@b.com', password: 'pass123', role: 'attendant' });
    expect(result).toMatchObject({ id: 'u-1', role: 'attendant' });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('GIVEN existing email WHEN register called THEN throws ConflictError', async () => {
    const repo = makeRepo({ id: 'u-1', email: 'a@b.com' });
    const useCase = new RegisterUseCase(repo);
    await expect(useCase.execute({ email: 'a@b.com', password: 'p', role: 'admin' }))
      .rejects.toMatchObject({ statusCode: 409 });
  });
});
