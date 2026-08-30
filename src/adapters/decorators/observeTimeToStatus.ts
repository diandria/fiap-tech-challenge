import { ServiceOrder } from '../../entities/ServiceOrder';
import { serviceOrderTimeToStatus } from '../../frameworks/metrics/businessMetrics';

/**
 * Registra quanto tempo se passou entre a abertura da ordem e o status que ela
 * acabou de atingir.
 *
 * A duracao vem de createdAt, que a entidade ja carrega, e nao de um cronometro
 * em volta da chamada: cronometrar o use case mediria o tempo do banco
 * responder, que e da ordem de milissegundos e cairia sempre no primeiro
 * bucket.
 */
export function observeTimeToStatus(order: ServiceOrder): void {
  const elapsedSeconds = (Date.now() - order.createdAt.getTime()) / 1000;
  serviceOrderTimeToStatus.observe({ to_status: order.status }, elapsedSeconds);
}
