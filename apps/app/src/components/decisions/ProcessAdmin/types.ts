import type { InstancePhaseData, PhaseRules } from '@op/api/encoders';

/**
 * One phase as the manage screens consume it, keyed by the row uuid that
 * `getDecisionBySlug` returns on each phase.
 */
export interface ProcessAdminPhase {
  /** The `decision_process_phases` row uuid; `null` until the decision's phases are stored as rows. */
  id: string | null;
  /**
   * Whether the instance's current phase is this one. A draft has one too; the
   * rail presents it as current only once the process is open.
   */
  isCurrent: boolean;
  /** Position in the rail, 0-based and contiguous. */
  sortOrder: number;
  name: string;
  description?: string;
  /** Absolute UTC instants, as the instance stores them. */
  startDate?: string;
  endDate?: string;
  rules?: PhaseRules;
  rubricTemplate?: InstancePhaseData['rubricTemplate'];
}
