export interface ManualSelectionAudit {
  byProfileId: string;
  at: string;
}

export interface TransitionData {
  manualSelection?: ManualSelectionAudit;
  [key: string]: unknown;
}
