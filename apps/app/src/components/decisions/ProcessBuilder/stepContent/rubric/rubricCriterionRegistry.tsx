import type { RubricCriterionType } from '../../../../decisions/rubricTemplate';

/**
 * Display metadata for each rubric criterion type.
 */
interface CriterionTypeRegistryEntry {
  /** Translation key for the type label */
  labelKey: string;
  /** Translation key for a short description shown in the radio selector */
  descriptionKey: string;
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
  long_text: {
    labelKey: 'Text response only',
    descriptionKey: 'No score, just written feedback',
  },
};

/**
 * Ordered list of criterion types for the radio selector.
 */
export const CRITERION_TYPES: RubricCriterionType[] = [
  'scored',
  'yes_no',
  'long_text',
];
