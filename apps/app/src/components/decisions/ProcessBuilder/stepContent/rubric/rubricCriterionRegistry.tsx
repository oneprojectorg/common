import type { TranslationKey } from '@/lib/i18n/routing';

import type { RubricCriterionType } from '@/components/decisions/rubricTemplate';

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
 * Ordered list of criterion types for the radio selector.
 * `money` is deliberately absent — template-authored for now.
 * TODO: add it here once money criteria become builder-editable.
 */
export const CRITERION_TYPES: RubricCriterionType[] = [
  'scored',
  'yes_no',
  'single_select',
  'long_text',
];
