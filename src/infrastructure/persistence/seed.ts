import { MongoUserRepository } from './repositories/MongoUserRepository';
import { RegisterUseCase } from '../../application/use-cases/auth/RegisterUseCase';

const DEFAULT_ADMIN_EMAIL = 'admin@master.com';
const DEFAULT_ADMIN_PASSWORD = 'admin';

export async function seedDefaultAdmin(): Promise<void> {
  const repo = new MongoUserRepository();
  const existing = await repo.findByEmail(DEFAULT_ADMIN_EMAIL);
  if (existing) return;

  const register = new RegisterUseCase(repo);
  await register.execute({ email: DEFAULT_ADMIN_EMAIL, password: DEFAULT_ADMIN_PASSWORD, role: 'admin' });
  console.log(`Default admin created — email: "${DEFAULT_ADMIN_EMAIL}", password: "${DEFAULT_ADMIN_PASSWORD}"`);
}
