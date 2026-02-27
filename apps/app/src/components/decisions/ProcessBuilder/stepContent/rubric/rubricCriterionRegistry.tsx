import type { IconType } from 'react-icons';
import {
  LuChevronDown,
  LuHash,
  LuLetterText,
  LuToggleRight,
} from 'react-icons/lu';

import type { RubricCriterionType } from '../../../../decisions/rubricTemplate';

/**
 * Display metadata for each rubric criterion type.
 */
interface CriterionTypeRegistryEntry {
  icon: IconType;
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
    icon: LuHash,
    labelKey: 'Scored',
    descriptionKey: 'Rate on a numeric scale with points',
  },
  yes_no: {
    icon: LuToggleRight,
    labelKey: 'Yes / No',
    descriptionKey: 'Simple yes or no answer',
  },
  dropdown: {
    icon: LuChevronDown,
    labelKey: 'Dropdown',
    descriptionKey: 'Select from custom options',
  },
  long_text: {
    icon: LuLetterText,
    labelKey: 'Long text',
    descriptionKey: 'Open-ended written feedback',
  },
};

/**
 * Ordered list of criterion types for the radio selector.
 */
export const CRITERION_TYPES: RubricCriterionType[] = [
  'scored',
  'yes_no',
  'dropdown',
  'long_text',
];

export function getCriterionIcon(type: RubricCriterionType): IconType {
  return CRITERION_TYPE_REGISTRY[type].icon;
}

export function getCriterionLabelKey(type: RubricCriterionType): string {
  return CRITERION_TYPE_REGISTRY[type].labelKey;
}
