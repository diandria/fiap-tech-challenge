import { SNSClient } from '@aws-sdk/client-sns';
import { INotificationService } from '../../use-cases/ports/INotificationService';
import { ConsoleNotificationService } from '../../adapters/services/ConsoleNotificationService';
import { SnsNotificationService } from '../../adapters/services/SnsNotificationService';

/**
 * Escolhe a implementacao de notificacao pelo ambiente.
 *
 * A escolha mora aqui, e nao dentro de um caso de uso: para quem publica um
 * evento, `console` e `sns` sao intercambiaveis atras do mesmo port. Nenhum
 * caso de uso sabe que existe SNS.
 */
export function createNotificationService(): INotificationService {
  if (process.env.NOTIFICATION_CHANNEL !== 'sns') {
    return new ConsoleNotificationService();
  }

  const topicArn = process.env.SNS_TOPIC_ARN;

  // Falha na subida, e nao na primeira notificacao. Sem esta guarda a
  // aplicacao sobe saudavel, passa nas sondas, e so descobre a configuracao
  // faltando quando um cliente deveria ser avisado -- que e quando a falha
  // custa mais e a causa esta mais longe do sintoma.
  if (!topicArn) {
    throw new Error('NOTIFICATION_CHANNEL=sns requer SNS_TOPIC_ARN');
  }

  return new SnsNotificationService(new SNSClient({}), topicArn);
}
