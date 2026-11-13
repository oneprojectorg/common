import type { ResultNotificationMessages } from '../resultNotificationTemplate';

export interface ManualSelectionAudit {
  byProfileId: string;
  at: string;
  /**
   * Stamped here rather than carried in the notification event: the results
   * publish in the same transaction, so a failed send can't lose the only copy
   * of what we told the authors. Final phase only.
   */
  resultNotifications?: ResultNotificationMessages;
}

/** What the selection pipeline decided about one proposal, with the values it computed. */
export interface SelectionOutcomeRecord {
  proposalId: string;
  /** `skipped` is reported by a block (a budget walk); `excluded` is dropped by a filter or limit. */
  outcome: 'selected' | 'skipped' | 'excluded';
  /** The pipeline's `metadata.*` fields, e.g. rankPoints, position, cost, budgetRemaining. */
  scores: Record<string, unknown>;
}

export interface SelectionAudit {
  /** One per proposal the pipeline saw: selected first, in output order, then the rest. */
  outcomes: SelectionOutcomeRecord[];
}

export interface TransitionData {
  manualSelection?: ManualSelectionAudit;
  /** Stamped when the departing phase ran a selection pipeline. */
  selection?: SelectionAudit;
  [key: string]: unknown;
}
