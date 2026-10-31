import jwt from 'jsonwebtoken';

/**
 * Signs a customer token in the same shape the issuing function produces.
 * Routes reject or accept it before any lookup, so the customer does not
 * need to exist.
 */
export function signCustomerToken(customerId: string, cpf = '52998224725'): string {
  return jwt.sign(
    { type: 'customer', sub: customerId, cpf, name: 'Customer' },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' },
  );
}
