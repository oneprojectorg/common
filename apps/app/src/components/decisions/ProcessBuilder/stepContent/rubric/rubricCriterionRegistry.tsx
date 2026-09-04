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
  // Template-authored, like `money`: absent from `CRITERION_TYPES`, so only
  // the label reaches the UI (the criterion card's type badge).
  multi_select: {
    labelKey: 'Check all that apply',
    descriptionKey: 'Reviewers select one or more options',
  },
  long_text: {
    labelKey: 'Text response only',
    descriptionKey: 'No score, just written feedback',
  },
  money: {
    labelKey: 'Amount',
    descriptionKey: 'Reviewers enter an amount',
  },
};

/**
 * Ordered list of criterion types for the radio selector.
 * `money` and `multi_select` are deliberately absent — both are
 * template-authored for now, so the builder must not offer them.
 * TODO: add money here once money criteria become builder-editable.
 */
export const CRITERION_TYPES: RubricCriterionType[] = [
  'scored',
  'yes_no',
  'single_select',
  'long_text',
];
