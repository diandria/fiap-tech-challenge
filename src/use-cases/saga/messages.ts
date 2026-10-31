import { ServiceOrder } from '../../entities/ServiceOrder';

/**
 * Replies the participants send to the saga replies queue (ADR-015). The list
 * grows as the orchestrator learns each step.
 */
export const SAGA_REPLY_TYPES = [
  'DiagnosisStarted',
  'DiagnosisCompleted',
  'BudgetGenerated',
  'BudgetApproved',
  'BudgetRejected',
  'PaymentConfirmed',
  'PaymentFailed',
  'RepairStarted',
  'RepairCompleted',
] as const;

export type SagaReplyType = (typeof SAGA_REPLY_TYPES)[number];

export interface SagaReply {
  messageId: string;
  type: SagaReplyType;
  serviceOrderId: string;
  payload: Record<string, unknown>;
}

/**
 * applied: the reply moved the order forward.
 * duplicate: the same message was handled before; nothing changed.
 * ignored: the order was not in the status the reply expects; nothing changed.
 */
export type SagaReplyOutcome = 'applied' | 'duplicate' | 'ignored';

/** Why a compensation started; sent along with the compensation commands. */
export type CompensationReason = 'BUDGET_REJECTED' | 'PAYMENT_FAILED';

export interface SagaReplyResult {
  outcome: SagaReplyOutcome;
  /** Present when applied. */
  serviceOrder?: ServiceOrder;
  /** Present when the reply started compensating the earlier steps. */
  compensation?: CompensationReason;
}

export interface BudgetLine {
  kind: 'SERVICE' | 'ITEM';
  referenceId: string;
  description: string;
  unitPrice: number;
  quantity: number;
}

/** Payload of GenerateBudget: everything the Billing Service needs, so it never reads the OS database. */
export interface GenerateBudgetCommand {
  customer: { id: string; name: string; email: string };
  lines: BudgetLine[];
}

/** Payload of EnqueueRepair: one task per service of the order, named as the catalog has it. */
export interface EnqueueRepairCommand {
  tasks: { serviceId: string; name: string }[];
}
