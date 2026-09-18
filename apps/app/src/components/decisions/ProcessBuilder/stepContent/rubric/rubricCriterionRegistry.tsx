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
    labelKey: 'decisions.processBuilder.criterionTypeScoredLabel',
    descriptionKey: 'decisions.processBuilder.criterionTypeScoredHint',
  },
  yes_no: {
    labelKey: 'decisions.processBuilder.criterionTypeYesNoLabel',
    descriptionKey: 'decisions.processBuilder.criterionTypeYesNoHint',
  },
  single_select: {
    labelKey: 'decisions.processBuilder.criterionTypeSingleSelectLabel',
    descriptionKey: 'decisions.processBuilder.criterionTypeSingleSelectHint',
  },
  // Template-authored, like `money`: absent from `CRITERION_TYPES`, so only
  // the label reaches the UI (the criterion card's type badge).
  multi_select: {
    labelKey: 'decisions.processBuilder.criterionTypeMultiSelectLabel',
    descriptionKey: 'decisions.processBuilder.criterionTypeMultiSelectHint',
  },
  long_text: {
    labelKey: 'decisions.processBuilder.criterionTypeLongTextLabel',
    descriptionKey: 'decisions.processBuilder.criterionTypeLongTextHint',
  },
  money: {
    labelKey: 'Amount',
    descriptionKey: 'decisions.processBuilder.criterionTypeMoneyHint',
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
