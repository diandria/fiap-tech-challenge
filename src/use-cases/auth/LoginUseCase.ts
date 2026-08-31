import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { IUserRepository } from '../ports/IUserRepository';
import { UnauthorizedError } from '../../entities/errors/AppError';

const TOKEN_EXPIRY = '24h';

interface LoginInput {
  email: string;
  password: string;
}

interface LoginOutput {
  token: string;
}

export class LoginUseCase {
  constructor(private readonly userRepo: IUserRepository) {}

  async execute({ email, password }: LoginInput): Promise<LoginOutput> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw new UnauthorizedError('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedError('Invalid credentials');

    const secret = process.env.JWT_SECRET!;
    // `type` explicit from issue time: the middleware does assume 'staff' when
    // it is missing, but that is compatibility with old tokens, not contract.
    const token = jwt.sign(
      { type: 'staff', userId: user.id, role: user.role },
      secret,
      { expiresIn: TOKEN_EXPIRY },
    );
    return { token };
  }
}
