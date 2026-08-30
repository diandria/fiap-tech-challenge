/**
 * Output Port de registro, definido pela camada de casos de uso.
 *
 * Existe porque dois casos de uso de notificacao precisam relatar falha de
 * entrega. Enquanto o registro acontecia so em middlewares e adaptadores,
 * depender da biblioteca diretamente era legitimo e este port seria cerimonia
 * sem inversao. A partir do momento em que a camada interna precisa registrar,
 * a inversao passa a ser necessaria (ADR-010).
 *
 * Enxuto de proposito: so os dois niveis que a camada interna usa.
 */
export interface ILogger {
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
