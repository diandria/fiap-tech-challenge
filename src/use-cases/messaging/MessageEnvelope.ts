/** Queues the OS Service sends commands to. Each maps to one participant. */
export type MessageDestination = 'billing-commands' | 'execution-commands';

/** The envelope every message carries, on every queue (ADR-015). */
export interface MessageEnvelope<TType extends string = string, TPayload = Record<string, unknown>> {
  messageId: string;
  type: TType;
  serviceOrderId: string;
  occurredAt: string;
  traceparent?: string;
  payload: TPayload;
}

/** What a use case asks to send; id, time and trace are filled when it is stored. */
export interface OutgoingMessage {
  destination: MessageDestination;
  type: string;
  serviceOrderId: string;
  payload: Record<string, unknown>;
}
