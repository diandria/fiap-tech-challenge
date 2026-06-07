import { MongoUserRepository } from '../../infrastructure/persistence/repositories/MongoUserRepository';
import { RegisterUseCase } from '../../use-cases/auth/RegisterUseCase';

export async function seedDefaultAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL ?? 'admin@master.com';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.warn('ADMIN_PASSWORD not set — skipping admin seed');
    return;
  }

  const repo = new MongoUserRepository();
  const existing = await repo.findByEmail(email);
  if (existing) return;

  const register = new RegisterUseCase(repo);
  await register.execute({ email, password, role: 'admin' });
  console.log(`Default admin created — email: "${email}"`);
}
