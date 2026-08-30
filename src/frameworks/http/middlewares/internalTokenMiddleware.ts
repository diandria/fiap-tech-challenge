import { timingSafeEqual } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../../entities/errors/AppError';

/**
 * Guarda do endpoint interno de lookup, consumido pela function de autenticacao.
 *
 * A comparacao e em tempo constante, e nao `===`, de proposito. Com `===` o
 * tempo de resposta varia conforme quantos caracteres iniciais coincidem, e o
 * segredo pode ser descoberto caractere a caractere por quem mede. O custo de
 * fazer certo aqui e uma linha.
 */
export function internalTokenMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const provided = Buffer.from(String(req.headers['x-internal-token'] ?? ''));
  const expected = Buffer.from(process.env.INTERNAL_TOKEN ?? '');

  // Sem segredo configurado nao existe comparacao valida: negar e a unica
  // resposta segura. Aceitar string vazia abriria a rota inteira num deploy
  // com variavel faltando.
  if (expected.length === 0 || provided.length !== expected.length) {
    return next(new UnauthorizedError());
  }
  if (!timingSafeEqual(provided, expected)) {
    return next(new UnauthorizedError());
  }
  next();
}
