// Process Builder Navigation Configuration
// Steps and sections are defined here with `as const` - types are derived from this config

export const STEPS = [
  { id: 'overview', labelKey: 'Overview' },
  { id: 'phases', labelKey: 'Phases' },
  { id: 'categories', labelKey: 'Proposal Categories' },
  { id: 'voting', labelKey: 'Voting' },
] as const;

// Derive StepId first so we can use it in SECTIONS_BY_STEP
export type StepId = (typeof STEPS)[number]['id'];

export const SECTIONS_BY_STEP = {
  overview: [
    { id: 'basics', labelKey: 'Basics' },
    { id: 'timeline', labelKey: 'Timeline' },
    { id: 'permissions', labelKey: 'Permissions' },
  ],
  phases: [
    { id: 'submission', labelKey: 'Submission' },
    { id: 'review', labelKey: 'Review' },
    { id: 'deliberation', labelKey: 'Deliberation' },
  ],
  categories: [
    { id: 'types', labelKey: 'Types' },
    { id: 'limits', labelKey: 'Limits' },
  ],
  voting: [
    { id: 'method', labelKey: 'Voting Method' },
    { id: 'quorum', labelKey: 'Quorum' },
    { id: 'results', labelKey: 'Results' },
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

// Default navigation config (all visible)
export const DEFAULT_NAVIGATION_CONFIG: NavigationConfig = {};
