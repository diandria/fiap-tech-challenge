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
  'ExecutionCancelled',
  'BudgetCancelled',
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
export const SAGA_REPLY_OUTCOMES = ['applied', 'duplicate', 'ignored'] as const;
export type SagaReplyOutcome = (typeof SAGA_REPLY_OUTCOMES)[number];

/** Why a compensation started; sent along with the compensation commands. */
export const COMPENSATION_REASONS = ['BUDGET_REJECTED', 'PAYMENT_FAILED', 'STEP_FAILED'] as const;
export type CompensationReason = (typeof COMPENSATION_REASONS)[number];

export interface SagaReplyResult {
  outcome: SagaReplyOutcome;
  /** Present when applied. */
  serviceOrder?: ServiceOrder;
  /** True when the message moved the order to a new status. */
  statusChanged?: true;
  /** Present when the message started compensating the earlier steps. */
  compensation?: CompensationReason;
  /** True when a dead command can no longer be compensated and needs a person. */
  stuck?: boolean;
}

/** Commands the OS Service sends, as they come back from a dead-letter queue. */
export const SAGA_COMMAND_TYPES = [
  'EnqueueDiagnosis',
  'GenerateBudget',
  'RequestPayment',
  'EnqueueRepair',
  'CancelExecution',
  'CancelBudget',
] as const;

export type SagaCommandType = (typeof SAGA_COMMAND_TYPES)[number];

/** A command a participant received five times and could not process. */
export interface FailedSagaCommand {
  messageId: string;
  type: SagaCommandType;
  serviceOrderId: string;
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
