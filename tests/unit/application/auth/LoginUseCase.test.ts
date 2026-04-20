import { LoginUseCase } from '../../../../src/application/use-cases/auth/LoginUseCase';
import { IUserRepository } from '../../../../src/domain/ports/IUserRepository';
import bcrypt from 'bcryptjs';

const hash = bcrypt.hashSync('secret123', 1);

const makeRepo = (user: any = null): IUserRepository => ({
  findByEmail: jest.fn().mockResolvedValue(user),
  findById: jest.fn(),
  create: jest.fn(),
});

describe('LoginUseCase', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('GIVEN valid credentials WHEN login called THEN returns JWT token string', async () => {
    const repo = makeRepo({ id: 'u-1', email: 'a@b.com', passwordHash: hash, role: 'admin' });
    const useCase = new LoginUseCase(repo);
    const result = await useCase.execute({ email: 'a@b.com', password: 'secret123' });
    expect(typeof result.token).toBe('string');
  });

  it('GIVEN unknown email WHEN login called THEN throws UnauthorizedError', async () => {
    const useCase = new LoginUseCase(makeRepo(null));
    await expect(useCase.execute({ email: 'x@y.com', password: 'p' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('GIVEN wrong password WHEN login called THEN throws UnauthorizedError', async () => {
    const repo = makeRepo({ id: 'u-1', email: 'a@b.com', passwordHash: hash, role: 'admin' });
    const useCase = new LoginUseCase(repo);
    await expect(useCase.execute({ email: 'a@b.com', password: 'wrong' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });
});
