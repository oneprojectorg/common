import type { TranslationKey } from '@/lib/i18n/routing';

import type {
  EditableRubricCriterionType,
  RubricCriterionType,
} from '@/components/decisions/rubricTemplate';

/**
 * Display metadata for each rubric criterion type.
 */
interface CriterionTypeRegistryEntry {
  /** Translation key for the type label */
  labelKey: TranslationKey;
  /** Translation key for a short description shown in the radio selector */
  descriptionKey: TranslationKey;
}

export const CRITERION_TYPE_REGISTRY: Record<
  RubricCriterionType,
  CriterionTypeRegistryEntry
> = {
  scored: {
    labelKey: 'Rating Scale',
    descriptionKey:
      'Reviewers select a number with descriptions for each point value',
  },
  yes_no: {
    labelKey: 'Yes/No',
    descriptionKey: 'Simple binary assessment',
  },
  single_select: {
    labelKey: 'Multiple choice',
    descriptionKey: 'Reviewers select one option',
  },
  long_text: {
    labelKey: 'Text response only',
    descriptionKey: 'No score, just written feedback',
  },
  money: {
    labelKey: 'Cost estimate',
    descriptionKey: 'Reviewers enter an amount',
  },
};

/**
 * Ordered list of criterion types offered in the radio selector. Money
 * criteria are template-authored, so they are not offered here — see
 * {@link EditableRubricCriterionType}.
 */
export const CRITERION_TYPES: EditableRubricCriterionType[] = [
  'scored',
  'yes_no',
  'single_select',
  'long_text',
];

/** Runtime predicate for the types the builder is allowed to assign. */
export function isEditableRubricCriterionType(
  value: string,
): value is EditableRubricCriterionType {
  return CRITERION_TYPES.some((type) => type === value);
}
