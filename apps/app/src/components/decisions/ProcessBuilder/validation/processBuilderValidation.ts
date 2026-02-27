import { SYSTEM_FIELD_KEYS } from '@op/common/client';
import { z } from 'zod';

import { getFieldErrors, getFields } from '../../proposalTemplate';
import type { SectionId } from '../navigationConfig';
import type { ProcessBuilderInstanceData } from '../stores/useProcessBuilderStore';

// ============ Types ============

export interface ValidationSummary {
  sections: Record<SectionId, boolean>;
  stepsRemaining: number;
  isReadyToLaunch: boolean;
  checklist: { id: string; labelKey: string; isValid: boolean }[];
}

// ============ Zod Schemas ============

const nonEmptyString = z.string().trim().min(1);

const overviewSchema = z.object({
  name: nonEmptyString,
  stewardProfileId: nonEmptyString,
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
  criteria: () => true,
  roles: () => true,
  participants: () => true,
};

// ============ Checklist Items ============

interface ChecklistItem {
  id: string;
  labelKey: string;
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
      const fields = getFields(data.proposalTemplate).filter(
        (f) => !SYSTEM_FIELD_KEYS.has(f.id),
      );
      return fields.every((field) => getFieldErrors(field).length === 0);
    },
  },
  {
    id: 'inviteMembers',
    labelKey: 'Invite participants',
    validate: () => true,
  },
];

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

  return {
    sections,
    stepsRemaining,
    isReadyToLaunch: stepsRemaining === 0,
    checklist,
  };
}
