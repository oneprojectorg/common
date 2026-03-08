// Process Builder Navigation Configuration
// Steps and sections are defined here with `as const` - types are derived from this config
import type { TranslationKey } from '@/lib/i18n';

export const STEPS = [
  { id: 'general', labelKey: 'General' },
  { id: 'template', labelKey: 'Proposal Template' },
  { id: 'rubric', labelKey: 'Review Rubric' },
  { id: 'participants', labelKey: 'Participants' },
  { id: 'summary', labelKey: 'Summary' },
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
  rubric: [{ id: 'criteria', labelKey: 'Criteria' }],
  participants: [
    { id: 'roles', labelKey: 'Roles & permissions' },
    { id: 'participants', labelKey: 'Participants' },
  ],
  summary: [{ id: 'summary', labelKey: 'Summary' }],
} as const satisfies Record<
  StepId,
  readonly { id: string; labelKey: TranslationKey }[]
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
    rubric: false,
    participants: true,
    summary: true,
  },
  sections: {
    general: ['overview', 'phases', 'proposalCategories'],
    template: ['templateEditor'],
    rubric: ['criteria'],
    participants: ['roles', 'participants'],
    summary: ['summary'],
  },
};

// Flat sidebar items for the unified sidebar navigation
export type SidebarItem =
  | {
      id: SectionId;
      labelKey: TranslationKey;
      parentStepId?: StepId;
      isDynamic?: false;
    }
  | { id: string; labelKey: string; parentStepId?: StepId; isDynamic: true };

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: 'overview', labelKey: 'Overview', parentStepId: 'general' },
  { id: 'phases', labelKey: 'Phases', parentStepId: 'general' },
  {
    id: 'proposalCategories',
    labelKey: 'Proposal Categories',
    parentStepId: 'general',
  },
  {
    id: 'templateEditor',
    labelKey: 'Proposal Template',
    parentStepId: 'template',
  },
  {
    id: 'criteria',
    labelKey: 'Review Rubric',
    parentStepId: 'rubric',
  },
  {
    id: 'roles',
    labelKey: 'Roles & permissions',
    parentStepId: 'participants',
  },
  {
    id: 'participants',
    labelKey: 'Participants',
    parentStepId: 'participants',
  },
  {
    id: 'summary',
    labelKey: 'Summary',
    parentStepId: 'summary',
  },
];

// Helper to create a dynamic phase section ID
export function phaseToSectionId(phaseId: string): string {
  return `phase-${phaseId}`;
}

// Helper to extract phaseId from a dynamic phase section ID
export function sectionIdToPhaseId(sectionId: string): string | null {
  if (sectionId.startsWith('phase-')) {
    return sectionId.slice(6);
  }
  return null;
}

// Check if a section ID is a dynamic phase section
export function isPhaseSection(sectionId: string): boolean {
  return sectionId.startsWith('phase-');
}

const SECTION_ID_SET = new Set<string>(
  Object.values(SECTIONS_BY_STEP).flatMap((sections) =>
    sections.map((s) => s.id),
  ),
);

// Type guard to narrow an arbitrary string to SectionId
export function isSectionId(id: string): id is SectionId {
  return SECTION_ID_SET.has(id);
}
