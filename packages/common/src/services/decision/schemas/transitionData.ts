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

export interface TransitionData {
  manualSelection?: ManualSelectionAudit;
  [key: string]: unknown;
}
