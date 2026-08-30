import { ServiceOrder } from '../../../entities/ServiceOrder';

/**
 * Transicao de status que so precisa da ordem de servico.
 *
 * Atende StartDiagnosis, FinishDiagnosis, StartExecution, FinishOS e DeliverOS,
 * que sao exatamente as cinco entradas do mapa statusHandlers do controller.
 * As decisoes de orcamento ficam de fora porque exigem um segundo argumento;
 * ver IDecideBudget.
 */
export interface IChangeServiceOrderStatus {
  execute(osId: string): Promise<ServiceOrder>;
}
