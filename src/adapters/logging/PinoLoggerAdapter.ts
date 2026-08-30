import { Logger } from 'pino';
import { ILogger } from '../../use-cases/ports/ILogger';

/**
 * Implementacao concreta do Output Port de registro. Fica na camada de
 * adaptadores, que e onde e legitimo conhecer a biblioteca.
 */
export class PinoLoggerAdapter implements ILogger {
  constructor(private readonly logger: Logger) {}

  warn(message: string, context: Record<string, unknown> = {}): void {
    this.logger.warn(context, message);
  }

  error(message: string, context: Record<string, unknown> = {}): void {
    this.logger.error(context, message);
  }
}
