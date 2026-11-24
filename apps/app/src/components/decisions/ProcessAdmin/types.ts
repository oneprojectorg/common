import type { InstancePhaseData, PhaseRules } from '@op/api/encoders';

/**
 * One phase as the manage screens consume it. The shape a future
 * `decision.listPhases` encoder emits: the row uuid is the only key, and the
 * current-phase match is resolved by the server rather than keyed on a slug.
 */
export interface ProcessAdminPhase {
  /** The `decision_process_phases` row uuid; the only identifier a screen or a mutation uses. */
  id: string;
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
