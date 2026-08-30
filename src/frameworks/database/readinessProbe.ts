import { PrismaClient } from '@prisma/client';
import { ReadinessCheck } from '../http/routes/healthRoutes';

/**
 * Consulta trivial so para provar que a conexao responde.
 *
 * SELECT 1 nao toca tabela nenhuma: a sonda nao deve depender do esquema estar
 * migrado, senao ela passa a reprovar por motivo diferente do que se quer medir.
 */
export function databaseReadiness(prisma: PrismaClient): ReadinessCheck {
  return () => prisma.$queryRaw`SELECT 1`;
}
