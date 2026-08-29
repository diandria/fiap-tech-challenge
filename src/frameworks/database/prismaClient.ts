import { PrismaClient } from '@prisma/client';

/**
 * Instancia unica do client. Apenas o Composition Root (main.ts) e o setup de
 * testes conhecem este modulo: os gateways recebem o client por construtor.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['warn', 'error'],
});

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
