import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../../../entities/User';
import { UnauthorizedError } from '../../../entities/errors/AppError';

/**
 * Funcionario da oficina, autenticado por e-mail e senha em `POST /auth/login`.
 */
export interface StaffJwtPayload {
  type: 'staff';
  userId: string;
  role: UserRole;
}

/**
 * Cliente, autenticado por CPF na function emissora (ADR-002). `sub` e o
 * `customerId`, e e a unica origem aceita dele: vindo do corpo ou da query, a
 * validacao de titularidade seria decorativa.
 */
export interface CustomerJwtPayload {
  type: 'customer';
  sub: string;
  cpf: string;
  name: string;
}

/**
 * Uniao discriminada por `type`. Discriminar em vez de somar campos opcionais
 * faz o compilador exigir o narrowing antes de qualquer acesso: nao ha como ler
 * `role` de um token de cliente sem que ele reclame.
 */
export type JwtPayload = StaffJwtPayload | CustomerJwtPayload;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Normaliza o que foi assinado para a uniao, ou devolve null quando o token nao
 * descreve nenhum dos dois atores.
 */
function toPayload(raw: Record<string, unknown>): JwtPayload | null {
  // Tokens emitidos antes desta mudanca nao tem `type`, e todos eles eram de
  // funcionario. Sem este padrao, cada um deles deixaria de funcionar de uma
  // vez -- inclusive os da suite de integracao.
  const type = raw.type ?? 'staff';

  if (type === 'staff') {
    if (typeof raw.userId !== 'string' || typeof raw.role !== 'string') return null;
    return { type: 'staff', userId: raw.userId, role: raw.role as UserRole };
  }

  if (type === 'customer') {
    // Sem `sub` a checagem de titularidade compararia contra undefined. Recusar
    // na porta e mais barato que descobrir depois por que um cliente enxergou a
    // OS de outro.
    if (typeof raw.sub !== 'string') return null;
    return {
      type: 'customer',
      sub: raw.sub,
      cpf: typeof raw.cpf === 'string' ? raw.cpf : '',
      name: typeof raw.name === 'string' ? raw.name : '',
    };
  }

  return null;
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new UnauthorizedError());
  }
  const token = header.split(' ')[1];
  let raw: Record<string, unknown>;
  try {
    raw = jwt.verify(token, process.env.JWT_SECRET!) as Record<string, unknown>;
  } catch {
    return next(new UnauthorizedError('Invalid or expired token'));
  }

  const payload = toPayload(raw);
  if (!payload) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }

  req.user = payload;
  next();
}
