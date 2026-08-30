import { ServiceOrder } from '../../entities/ServiceOrder';
import { ForbiddenError } from '../../entities/errors/AppError';

/**
 * Titularidade da ordem de servico.
 *
 * Mora na camada de aplicacao, e nao num middleware, porque e regra de negocio.
 * Um middleware nao teria como saber de quem e a OS sem consultar o
 * repositorio -- e se consultasse, estaria fazendo trabalho de caso de uso
 * dentro da camada de frameworks.
 *
 * E e isso que a torna portatil: quando o contexto de ordens de servico virar
 * servico proprio, a regra viaja junto. Se morasse no gateway, ficaria para
 * tras na extracao, e o servico novo nasceria confiando que alguem antes dele
 * validou.
 *
 * `requesterCustomerId` ausente significa chamada de funcionario, que ja passou
 * pelo `requireRole` da rota. Nao restringir aqui e deliberado: sem isso, toda
 * rota de staff precisaria informar um dono ficticio.
 */
export function assertOwnership(os: ServiceOrder, requesterCustomerId?: string): void {
  if (requesterCustomerId && os.customerId !== requesterCustomerId) {
    throw new ForbiddenError();
  }
}
