import bcrypt from 'bcryptjs';
import { LoginUseCase } from '../../../../src/application/use-cases/auth/LoginUseCase';
import { IUserRepository } from '../../../../src/domain/ports/IUserRepository';
import { User } from '../../../../src/domain/entities/User';

const mockUser: User = {
  id: 'user-1',
  email: 'admin@test.com',
  passwordHash: bcrypt.hashSync('password123', 1),
  role: 'admin',
};

const makeRepo = (override?: Partial<IUserRepository>): IUserRepository => ({
  findById: jest.fn(),
  findByEmail: jest.fn().mockResolvedValue(mockUser),
  create: jest.fn(),
  ...override,
});

describe('LoginUseCase', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('returns a token for valid credentials', async () => {
    const useCase = new LoginUseCase(makeRepo());
    const result = await useCase.execute({ email: 'admin@test.com', password: 'password123' });
    expect(typeof result.token).toBe('string');
    expect(result.token.split('.').length).toBe(3); // valid JWT structure
  });

  it('throws UnauthorizedError when email is not found', async () => {
    const useCase = new LoginUseCase(makeRepo({ findByEmail: jest.fn().mockResolvedValue(null) }));
    await expect(useCase.execute({ email: 'x@x.com', password: 'pw' }))
      .rejects.toMatchObject({ message: 'Invalid credentials', statusCode: 401 });
  });

  it('throws UnauthorizedError for wrong password', async () => {
    const useCase = new LoginUseCase(makeRepo());
    await expect(useCase.execute({ email: 'admin@test.com', password: 'wrong' }))
      .rejects.toMatchObject({ message: 'Invalid credentials', statusCode: 401 });
  });
});
