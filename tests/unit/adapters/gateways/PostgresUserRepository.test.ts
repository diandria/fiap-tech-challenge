import { PostgresUserRepository } from '../../../../src/adapters/gateways/PostgresUserRepository';

function makePrisma() {
  return { user: { findUnique: jest.fn(), create: jest.fn() } } as any;
}

const row = { id: 'u1', email: 'admin@master.com', passwordHash: 'hash', role: 'admin' };

describe('PostgresUserRepository', () => {
  it('should map a row to a User entity GIVEN an existing row WHEN findByEmail is called', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(row);

    const user = await new PostgresUserRepository(prisma).findByEmail('admin@master.com');

    expect(user).toEqual(row);
  });

  it('should return null GIVEN no row WHEN findByEmail is called', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);

    expect(await new PostgresUserRepository(prisma).findByEmail('nope@x.com')).toBeNull();
  });

  it('should return null GIVEN no row WHEN findById is called', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);

    expect(await new PostgresUserRepository(prisma).findById('nope')).toBeNull();
  });

  it('should persist the role GIVEN user data WHEN create is called', async () => {
    const prisma = makePrisma();
    prisma.user.create.mockResolvedValue(row);

    await new PostgresUserRepository(prisma).create({
      email: 'admin@master.com',
      passwordHash: 'hash',
      role: 'admin',
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { email: 'admin@master.com', passwordHash: 'hash', role: 'admin' },
    });
  });
});
