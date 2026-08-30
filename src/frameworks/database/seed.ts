import { IUserRepository } from '../../use-cases/ports/IUserRepository';
import { RegisterUseCase } from '../../use-cases/auth/RegisterUseCase';
import { logger } from '../logging/logger';

/**
 * Recebe o repositorio ja construido: quem escolhe a implementacao concreta e o
 * Composition Root, nao o seed.
 */
export async function seedDefaultAdmin(repo: IUserRepository): Promise<void> {
  const email = process.env.ADMIN_EMAIL ?? 'admin@master.com';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    logger.warn('ADMIN_PASSWORD not set, skipping admin seed');
    return;
  }

  const existing = await repo.findByEmail(email);
  if (existing) return;

  const register = new RegisterUseCase(repo);
  await register.execute({ email, password, role: 'admin' });
  logger.info({ email }, 'default admin created');
}
