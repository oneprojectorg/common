import {
  SECTIONS_BY_STEP,
  STEPS,
  type SectionId,
  type StepId,
} from '../navigationConfig';
import type { FormInstanceData } from '../stores/useProcessBuilderStore';

// ============ Types ============

export interface SectionValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface StepValidationResult {
  isValid: boolean;
  sections: Partial<Record<SectionId, SectionValidationResult>>;
}

export interface ChecklistItem {
  id: string;
  labelKey: string;
  validate: (data: FormInstanceData | undefined) => boolean;
}

export interface ValidationSummary {
  steps: Record<StepId, StepValidationResult>;
  stepsRemaining: number;
  isReadyToLaunch: boolean;
  checklist: { id: string; labelKey: string; isValid: boolean }[];
}

// ============ Section Validators ============

type SectionValidator = (
  data: FormInstanceData | undefined,
) => SectionValidationResult;

function validateOverview(
  data: FormInstanceData | undefined,
): SectionValidationResult {
  const errors: string[] = [];

  if (!data?.name?.trim()) {
    errors.push('Name is required');
  }
  if (!data?.stewardProfileId) {
    errors.push('Steward is required');
  }
  if (!data?.objective?.trim()) {
    errors.push('Objective is required');
  }
  if (!data?.description?.trim()) {
    errors.push('Description is required');
  }

  return { isValid: errors.length === 0, errors };
}

function validatePhases(
  data: FormInstanceData | undefined,
): SectionValidationResult {
  const errors: string[] = [];
  const phases = data?.phases;

  if (!phases || phases.length === 0) {
    errors.push('At least one phase is required');
    return { isValid: false, errors };
  }

  for (const phase of phases) {
    if (!phase.name?.trim()) {
      errors.push(
        `Phase "${phase.phaseId}" is missing a name`,
      );
    }
    if (!phase.endDate) {
      errors.push(
        `Phase "${phase.name ?? phase.phaseId}" is missing an end date`,
      );
    }
  }

  return { isValid: errors.length === 0, errors };
}

function placeholderValidator(): SectionValidationResult {
  return { isValid: false, errors: ['Not yet configured'] };
}

function alwaysValidValidator(): SectionValidationResult {
  return { isValid: true, errors: [] };
}

// ============ Validator Registry ============

const VALIDATOR_REGISTRY: Record<SectionId, SectionValidator> = {
  overview: validateOverview,
  phases: validatePhases,
  proposalCategories: placeholderValidator,
  templateEditor: placeholderValidator,
  criteria: placeholderValidator,
  settings: alwaysValidValidator,
  roles: alwaysValidValidator,
  members: alwaysValidValidator,
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
      !!data?.objective?.trim() &&
      !!data?.description?.trim(),
  },
  {
    id: 'atLeastOnePhase',
    labelKey: 'Add at least one phase',
    validate: (data) => (data?.phases?.length ?? 0) > 0,
  },
  {
    id: 'phaseDetails',
    labelKey: 'Ensure all phases have a title and end date',
    validate: (data) => {
      const phases = data?.phases;
      if (!phases?.length) {
        return false;
      }
      return phases.every((p) => !!p.name?.trim() && !!p.endDate);
    },
  },
  {
    id: 'proposalTemplate',
    labelKey: 'Create a proposal template',
    validate: (data) => !!data?.proposalTemplate,
  },
  {
    id: 'inviteMembers',
    labelKey: 'Invite members',
    validate: () => true,
  },
];

// ============ Step & Summary Validation ============

function validateStep(
  stepId: StepId,
  data: FormInstanceData | undefined,
): StepValidationResult {
  const sectionDefs = SECTIONS_BY_STEP[stepId];
  const sections: Partial<Record<SectionId, SectionValidationResult>> = {};

  for (const section of sectionDefs) {
    const sectionId = section.id as SectionId;
    const validator = VALIDATOR_REGISTRY[sectionId];
    sections[sectionId] = validator(data);
  }

  const isValid = Object.values(sections).every((s) => s.isValid);

  return { isValid, sections };
}

export function validateAllSteps(
  data: FormInstanceData | undefined,
): ValidationSummary {
  const steps = {} as Record<StepId, StepValidationResult>;

  for (const step of STEPS) {
    steps[step.id] = validateStep(step.id, data);
  }

  const stepsRemaining = Object.values(steps).filter((s) => !s.isValid).length;

  const checklist = LAUNCH_CHECKLIST.map((item) => ({
    id: item.id,
    labelKey: item.labelKey,
    isValid: item.validate(data),
  }));

  return {
    steps,
    stepsRemaining,
    isReadyToLaunch: stepsRemaining === 0,
    checklist,
  };
}
