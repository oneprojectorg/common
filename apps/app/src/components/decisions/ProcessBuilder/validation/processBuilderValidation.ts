import { getFieldErrors, getFields } from '../../proposalTemplate';
import type { SectionId } from '../navigationConfig';
import type { FormInstanceData } from '../stores/useProcessBuilderStore';

// ============ Types ============

export interface ChecklistItem {
  id: string;
  labelKey: string;
  validate: (data: FormInstanceData | undefined) => boolean;
}

export interface ValidationSummary {
  sections: Record<SectionId, boolean>;
  stepsRemaining: number;
  isReadyToLaunch: boolean;
  checklist: { id: string; labelKey: string; isValid: boolean }[];
}

// ============ Section Validators ============

type SectionValidator = (data: FormInstanceData | undefined) => boolean;

function validateOverview(data: FormInstanceData | undefined): boolean {
  return (
    !!data?.name?.trim() &&
    !!data?.stewardProfileId &&
    !!data?.description?.trim()
  );
}

function validatePhases(data: FormInstanceData | undefined): boolean {
  const phases = data?.phases;
  if (!phases?.length) {
    return false;
  }
  return phases.every(
    (p) =>
      !!p.name?.trim() &&
      !!p.headline?.trim() &&
      !!p.description?.trim() &&
      !!p.endDate,
  );
}

function validateProposalCategories(): boolean {
  return true;
}

function validateTemplateEditor(data: FormInstanceData | undefined): boolean {
  if (!data?.proposalTemplate) {
    return false;
  }
  const fields = getFields(data.proposalTemplate);
  return fields.every((field) => getFieldErrors(field).length === 0);
}

const SECTION_VALIDATORS: Record<SectionId, SectionValidator> = {
  overview: validateOverview,
  phases: validatePhases,
  proposalCategories: validateProposalCategories,
  templateEditor: validateTemplateEditor,
  criteria: () => true,
  settings: () => true,
  roles: () => true,
  members: () => true,
};

// ============ Checklist Items ============

/**
 * User-facing checklist items for the "steps remaining" popover.
 * Each item has its own validator — independent of the section structure —
 * so one section can map to multiple checklist items with different granularity.
 */
export const LAUNCH_CHECKLIST: ChecklistItem[] = [
  {
    id: 'processNameDescription',
    labelKey: 'Process name & description',
    validate: (data) =>
      !!data?.name?.trim() &&
      !!data?.stewardProfileId &&
      !!data?.description?.trim(),
  },
  {
    id: 'atLeastOnePhase',
    labelKey: 'Add at least one phase',
    validate: (data) => (data?.phases?.length ?? 0) > 0,
  },
  {
    id: 'phaseDetails',
    labelKey: 'Complete all required phase fields',
    validate: (data) => {
      const phases = data?.phases;
      if (!phases?.length) {
        return false;
      }
      return phases.every(
        (p) =>
          !!p.name?.trim() &&
          !!p.headline?.trim() &&
          !!p.description?.trim() &&
          !!p.endDate,
      );
    },
  },
  {
    id: 'proposalTemplate',
    labelKey: 'Create a proposal template',
    validate: (data) =>
      !!data?.proposalTemplate && getFields(data.proposalTemplate).length > 0,
  },
  {
    id: 'proposalTemplateErrors',
    labelKey: 'Fix errors in the proposal template',
    validate: (data) => {
      if (!data?.proposalTemplate) {
        return true;
      }
      const fields = getFields(data.proposalTemplate);
      return fields.every((field) => getFieldErrors(field).length === 0);
    },
  },
  {
    id: 'inviteMembers',
    labelKey: 'Invite members',
    validate: () => true,
  },
];

// ============ Validation ============

export function validateAll(
  data: FormInstanceData | undefined,
): ValidationSummary {
  const sections = {} as Record<SectionId, boolean>;
  for (const [sectionId, validator] of Object.entries(SECTION_VALIDATORS)) {
    sections[sectionId as SectionId] = validator(data);
  }

  const checklist = LAUNCH_CHECKLIST.map((item) => ({
    id: item.id,
    labelKey: item.labelKey,
    isValid: item.validate(data),
  }));

  const stepsRemaining = checklist.filter((item) => !item.isValid).length;

  return {
    sections,
    stepsRemaining,
    isReadyToLaunch: stepsRemaining === 0,
    checklist,
  };
}
