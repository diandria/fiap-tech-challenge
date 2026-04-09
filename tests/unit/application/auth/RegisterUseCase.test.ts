import { RegisterUseCase } from '../../../../src/application/use-cases/auth/RegisterUseCase';
import { IUserRepository } from '../../../../src/domain/ports/IUserRepository';
import { User } from '../../../../src/domain/entities/User';

const existingUser: User = {
  id: 'user-1',
  email: 'existing@test.com',
  passwordHash: 'hash',
  role: 'admin',
};

const makeRepo = (override?: Partial<IUserRepository>): IUserRepository => ({
  findById: jest.fn(),
  findByEmail: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'new-id', ...data })),
  ...override,
});

describe('RegisterUseCase', () => {
  it('creates a user and returns it without passwordHash', async () => {
    const useCase = new RegisterUseCase(makeRepo());
    const result = await useCase.execute({ email: 'new@test.com', password: 'pass123', role: 'attendant' });
    expect(result.email).toBe('new@test.com');
    expect(result.role).toBe('attendant');
    expect((result as any).passwordHash).toBeUndefined();
  });

  it('throws ConflictError if email is already in use', async () => {
    const useCase = new RegisterUseCase(makeRepo({ findByEmail: jest.fn().mockResolvedValue(existingUser) }));
    await expect(useCase.execute({ email: 'existing@test.com', password: 'pass', role: 'mechanic' }))
      .rejects.toMatchObject({ message: 'Email already in use', statusCode: 409 });
  });

  it('hashes the password before storing', async () => {
    const repo = makeRepo();
    const useCase = new RegisterUseCase(repo);
    await useCase.execute({ email: 'new@test.com', password: 'plain', role: 'admin' });
    const createCall = (repo.create as jest.Mock).mock.calls[0][0];
    expect(createCall.passwordHash).not.toBe('plain');
    expect(createCall.passwordHash.startsWith('$2')).toBe(true); // bcrypt prefix
  });
});
