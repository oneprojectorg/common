import { SYSTEM_FIELD_KEYS } from '@op/common/client';
import { z } from 'zod';

import type { TranslationKey } from '@/lib/i18n';

import { getFieldErrors, getFields } from '../../proposalTemplate';
import { getCriteria, getCriterionErrors } from '../../rubricTemplate';
import type { SectionId } from '../navigationConfig';
import type { ProcessBuilderInstanceData } from '../stores/useProcessBuilderStore';

// ============ Types ============

export interface ValidationSummary {
  sections: Record<SectionId, boolean>;
  stepsRemaining: number;
  isReadyToLaunch: boolean;
  completionPercentage: number;
  checklist: { id: string; labelKey: TranslationKey; isValid: boolean }[];
}

// ============ Zod Schemas ============

const nonEmptyString = z.string().trim().min(1);

const overviewSchema = z.object({
  name: nonEmptyString,
  description: nonEmptyString,
});

const phaseSchema = z.object({
  name: nonEmptyString,
  headline: nonEmptyString,
  description: nonEmptyString,
  endDate: nonEmptyString,
});

const phasesSchema = z.object({
  phases: z.array(phaseSchema).min(1),
});

// ============ Helpers ============

/** Returns true when at least one phase has review enabled. */
function hasReviewPhase(data: ProcessBuilderInstanceData | undefined): boolean {
  return (data?.phases ?? []).some((p) => p.rules?.proposals?.review === true);
}

/** Returns true when the rubric template contains at least one criterion. */
function hasRubricCriteria(
  data: ProcessBuilderInstanceData | undefined,
): boolean {
  const order = data?.rubricTemplate?.['x-field-order'];
  return Array.isArray(order) && order.length > 0;
}

/** Returns true when every rubric criterion has all required fields filled in. */
function allRubricCriteriaValid(
  data: ProcessBuilderInstanceData | undefined,
): boolean {
  if (!data?.rubricTemplate) {
    return true;
  }
  const criteria = getCriteria(data.rubricTemplate);
  return criteria.every((c) => getCriterionErrors(c).length === 0);
}

// ============ Section Validators ============

type SectionValidator = (
  data: ProcessBuilderInstanceData | undefined,
) => boolean;

function validateTemplateEditor(
  data: ProcessBuilderInstanceData | undefined,
): boolean {
  if (!data?.proposalTemplate) {
    return false;
  }
  const fields = getFields(data.proposalTemplate);
  return fields.every((field) => getFieldErrors(field).length === 0);
}

const SECTION_VALIDATORS: Record<SectionId, SectionValidator> = {
  overview: (data) => overviewSchema.safeParse(data).success,
  phases: (data) => phasesSchema.safeParse(data).success,
  proposalCategories: () => true,
  templateEditor: validateTemplateEditor,
  reviewSettings: () => true,
  reviewRubric: (data) =>
    !hasReviewPhase(data) ||
    (hasRubricCriteria(data) && allRubricCriteriaValid(data)),
  roles: () => true,
  participants: () => true,
  summary: (data) => LAUNCH_CHECKLIST.every((item) => item.validate(data)),
};

// ============ Checklist Items ============

interface ChecklistItem {
  id: string;
  labelKey: TranslationKey;
  validate: (data: ProcessBuilderInstanceData | undefined) => boolean;
}

/**
 * User-facing checklist items for the "steps remaining" popover.
 * Each item has its own validator — independent of the section structure —
 * so one section can map to multiple checklist items with different granularity.
 */
const LAUNCH_CHECKLIST: ChecklistItem[] = [
  {
    id: 'processNameDescription',
    labelKey: 'Process name & description',
    validate: (data) => overviewSchema.safeParse(data).success,
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
        return true;
      }
      return z.array(phaseSchema).safeParse(phases).success;
    },
  },
  {
    id: 'proposalTemplate',
    labelKey: 'Create a proposal template',
    validate: (data) => {
      if (!data?.proposalTemplate) {
        return false;
      }
      const nonSystemFields = getFields(data.proposalTemplate).filter(
        (f) => !SYSTEM_FIELD_KEYS.has(f.id),
      );
      return nonSystemFields.length > 0;
    },
  },
  {
    id: 'proposalTemplateErrors',
    labelKey: 'Fix errors in the proposal template',
    validate: (data) => {
      if (!data?.proposalTemplate) {
        return true;
      }
      const fields = getFields(data.proposalTemplate).filter(
        (f) => !SYSTEM_FIELD_KEYS.has(f.id),
      );
      return fields.every((field) => getFieldErrors(field).length === 0);
    },
  },
  {
    id: 'rubricCriteria',
    labelKey: 'Add at least one rubric criterion',
    validate: (data) => !hasReviewPhase(data) || hasRubricCriteria(data),
  },
  {
    id: 'rubricCriteriaErrors',
    labelKey: 'Fix errors in rubric criteria',
    validate: (data) => !hasReviewPhase(data) || allRubricCriteriaValid(data),
  },
  {
    id: 'inviteMembers',
    labelKey: 'Invite participants',
    validate: () => true,
  },
];

// ============ Phase Validation ============

export function isPhaseValid(phase: {
  name?: string | null;
  headline?: string | null;
  description?: string | null;
  endDate?: string | null;
}): boolean {
  return phaseSchema.safeParse(phase).success;
}

// ============ Validation ============

export function validateAll(
  data: ProcessBuilderInstanceData | undefined,
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
  const completionPercentage =
    checklist.length > 0
      ? Math.round(
          ((checklist.length - stepsRemaining) / checklist.length) * 100,
        )
      : 0;

  return {
    sections,
    stepsRemaining,
    isReadyToLaunch: stepsRemaining === 0,
    completionPercentage,
    checklist,
  };
}
