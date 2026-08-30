import { Prisma } from '@prisma/client';

/**
 * Distingue banco indisponivel de erro esperado da aplicacao.
 *
 * Os codigos P1xxx do Prisma sao de conectividade (nao alcancou o servidor,
 * tempo esgotado, conexao fechada). Os P2xxx sao de consulta: violacao de
 * unicidade, registro inexistente, chave estrangeira. Estes ultimos sao
 * comportamento normal, e conta-los como falha de integracao faria o alerta
 * disparar por CPF duplicado.
 */
export function isConnectivityError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientRustPanicError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) return err.code.startsWith('P1');
  return false;
}
