import { RegisterUseCase } from '../../../../src/application/use-cases/auth/RegisterUseCase';
import { IUserRepository } from '../../../../src/use-cases/ports/IUserRepository';

const makeRepo = (existing: any = null): IUserRepository => ({
  findByEmail: jest.fn().mockResolvedValue(existing),
  findById: jest.fn(),
  create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'u-1', ...data })),
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
      .rejects.toMatchObject({ message: 'Email already in use', statusCode: 409 });
  });

  it('GIVEN plaintext password WHEN register called THEN stores bcrypt hash not plain text', async () => {
    const repo = makeRepo(null);
    const useCase = new RegisterUseCase(repo);
    await useCase.execute({ email: 'a@b.com', password: 'plain', role: 'admin' });
    const createCall = (repo.create as jest.Mock).mock.calls[0][0];
    expect(createCall.passwordHash).not.toBe('plain');
    expect(createCall.passwordHash.startsWith('$2')).toBe(true); // bcrypt prefix
  });
});
