import type { ResultNotificationMessages } from '../resultNotificationTemplate';

export interface ManualSelectionAudit {
  byProfileId: string;
  at: string;
  /**
   * The message bodies an admin composed for proposal authors, verbatim as they
   * typed them (placeholders unresolved). Stamped here rather than carried in
   * the notification event: the results publish in the same transaction, and a
   * failed event send must not be able to lose the only copy of what we told
   * the authors. Present only on the final phase, where results publish.
   */
  resultNotifications?: ResultNotificationMessages;
}

export interface TransitionData {
  manualSelection?: ManualSelectionAudit;
  [key: string]: unknown;
}
