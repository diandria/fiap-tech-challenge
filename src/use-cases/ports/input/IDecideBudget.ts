import { ServiceOrder } from '../../../entities/ServiceOrder';

/**
 * Aprovacao e recusa de orcamento.
 *
 * Separado de IChangeServiceOrderStatus por causa do codigo de confirmacao, que
 * identifica quem decidiu. Juntar os dois num port so exigiria um parametro
 * opcional que metade dos implementadores ignoraria.
 */
export interface IDecideBudget {
  execute(osId: string, code: string): Promise<ServiceOrder>;
}
