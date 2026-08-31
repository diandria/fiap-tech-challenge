import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { Customer } from '../../entities/Customer';
import { ServiceOrder } from '../../entities/ServiceOrder';
import { INotificationService } from '../../use-cases/ports/INotificationService';
import { getTraceContext, toTraceparent } from '../../frameworks/logging/context';
import { integrationFailures } from '../../frameworks/metrics/integrationMetrics';

const INTEGRATION = 'sns';

type EventType = 'SERVICE_ORDER_STATUS_CHANGED' | 'BUDGET_READY';

/**
 * Entrega de notificacao publicando evento num topico SNS.
 *
 * E a segunda implementacao de um port que existe desde a Fase 2: trocar
 * `console.log` por publicacao nao abriu nenhum caso de uso. A escolha entre
 * este e o ConsoleNotificationService acontece no Composition Root, por
 * NOTIFICATION_CHANNEL.
 *
 * O formato do payload e o contrato do ADR-003, implementado tambem -- e
 * separadamente -- pela function que consome o topico. Os dois repositorios
 * nao compartilham codigo de proposito; o acoplamento e o contrato escrito.
 */
export class SnsNotificationService implements INotificationService {
  constructor(
    private readonly sns: SNSClient,
    private readonly topicArn: string,
  ) {}

  async notifyStatusChanged(customer: Customer, os: ServiceOrder): Promise<void> {
    await this.publish('SERVICE_ORDER_STATUS_CHANGED', 'status_changed', customer, os);
  }

  async notifyBudgetReady(customer: Customer, os: ServiceOrder): Promise<void> {
    await this.publish('BUDGET_READY', 'budget_ready', customer, os);
  }

  private buildPayload(eventType: EventType, customer: Customer, os: ServiceOrder): string {
    const ctx = getTraceContext();

    return JSON.stringify({
      eventType,
      occurredAt: new Date().toISOString(),

      // Omitido fora de uma requisicao HTTP, onde nao ha rastro. Publicar um
      // traceparent invalido seria pior que omitir: o consumidor o registraria
      // e o Grafana juntaria eventos sem relacao nenhuma.
      ...(ctx && { traceparent: toTraceparent(ctx) }),

      serviceOrder: {
        id: os.id,
        status: os.status,
        ...(os.budgetTotal !== undefined && { budgetTotal: os.budgetTotal }),
      },

      // Apenas o que o consumidor usa para montar a mensagem. Documento e
      // telefone nao entram: dado que nao trafega nao vaza, e o topico e uma
      // fronteira de confianca a mais.
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
      },
    });
  }

  /**
   * Conta a falha e relanca, no mesmo padrao do ConsoleNotificationService: o
   * erro segue chegando ao catch do caso de uso, que nao reverte a transicao
   * de status. Engolir aqui mudaria a semantica para ganhar nada.
   */
  private async publish(
    eventType: EventType,
    operation: string,
    customer: Customer,
    os: ServiceOrder,
  ): Promise<void> {
    try {
      await this.sns.send(
        new PublishCommand({
          TopicArn: this.topicArn,
          Message: this.buildPayload(eventType, customer, os),
        }),
      );
    } catch (err) {
      integrationFailures.inc({ integration: INTEGRATION, operation });
      throw err;
    }
  }
}
