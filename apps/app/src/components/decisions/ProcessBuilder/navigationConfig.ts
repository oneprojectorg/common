// Process Builder Navigation Configuration
// Steps and sections are defined here with `as const` - types are derived from this config

export const STEPS = [
  { id: 'general', labelKey: 'General' },
  { id: 'template', labelKey: 'Proposal Template' },
  { id: 'rubric', labelKey: 'Review Rubric' },
  { id: 'members', labelKey: 'Members' },
] as const;

// Derive StepId first so we can use it in SECTIONS_BY_STEP
export type StepId = (typeof STEPS)[number]['id'];

export const SECTIONS_BY_STEP = {
  general: [
    { id: 'overview', labelKey: 'Overview' },
    { id: 'phases', labelKey: 'Phases' },
    { id: 'proposalCategories', labelKey: 'Proposal Categories' },
  ],
  template: [{ id: 'templateEditor', labelKey: 'Template Editor' }],
  rubric: [
    { id: 'criteria', labelKey: 'Criteria' },
    { id: 'settings', labelKey: 'Settings' },
  ],
  members: [
    { id: 'roles', labelKey: 'Roles & permissions' },
    { id: 'members', labelKey: 'Members' },
  ],
} as const satisfies Record<
  StepId,
  readonly { id: string; labelKey: string }[]
>;

// Derive SectionId from all sections across all steps
export type SectionId = (typeof SECTIONS_BY_STEP)[StepId][number]['id'];

// Navigation configuration (from API)
export interface NavigationConfig {
  steps?: Partial<Record<StepId, boolean>>;
  sections?: Partial<Record<StepId, SectionId[]>>;
}

// Default navigation config (all steps and sections visible)
export const DEFAULT_NAVIGATION_CONFIG: NavigationConfig = {
  steps: {
    general: true,
    template: true,
    rubric: true,
    members: true,
  },
  sections: {
    general: ['overview', 'phases', 'proposalCategories'],
    template: ['templateEditor'],
    rubric: ['criteria', 'settings'],
    members: ['roles', 'members'],
  },
};
