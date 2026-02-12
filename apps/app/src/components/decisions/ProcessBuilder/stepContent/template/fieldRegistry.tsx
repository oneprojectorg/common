import type { ComponentType } from 'react';
import type { IconType } from 'react-icons';
import {
  LuAlignLeft,
  LuCalendar,
  LuChevronDown,
  LuHash,
  LuLetterText,
  LuListChecks,
  LuToggleLeft,
} from 'react-icons/lu';

import type { ProposalPropertySchema } from '../../../proposalEditor/compileProposalSchema';
import type { FieldType, FieldView } from '../../../proposalTemplate';
import { FieldConfigDropdown } from './FieldConfigDropdown';
import { FieldConfigNumber } from './FieldConfigNumber';

/**
 * Props passed to field config components.
 */
export interface FieldConfigProps {
  field: FieldView;
  fieldSchema: ProposalPropertySchema;
  onUpdateJsonSchema: (updates: Partial<ProposalPropertySchema>) => void;
}

/**
 * Configuration for each field type including icon and labels.
 */
interface FieldTypeRegistryEntry {
  icon: IconType;
  labelKey: string;
  placeholderKey: string;
  ConfigComponent?: ComponentType<FieldConfigProps>;
}

/**
 * Registry mapping field types to their configuration.
 */
export const FIELD_TYPE_REGISTRY: Record<FieldType, FieldTypeRegistryEntry> = {
  short_text: {
    icon: LuAlignLeft,
    labelKey: 'Short text',
    placeholderKey: 'Short answer text',
  },
  long_text: {
    icon: LuLetterText,
    labelKey: 'Long text',
    placeholderKey: 'Long answer text',
  },
  multiple_choice: {
    icon: LuListChecks,
    labelKey: 'Multiple choice',
    placeholderKey: 'Select options',
    ConfigComponent: FieldConfigDropdown,
  },
  dropdown: {
    icon: LuChevronDown,
    labelKey: 'Dropdown',
    placeholderKey: 'Select an option',
    ConfigComponent: FieldConfigDropdown,
  },
  yes_no: {
    icon: LuToggleLeft,
    labelKey: 'Yes/no',
    placeholderKey: 'Yes or No',
  },
  date: {
    icon: LuCalendar,
    labelKey: 'Date',
    placeholderKey: 'Select a date',
  },
  number: {
    icon: LuHash,
    labelKey: 'Number',
    placeholderKey: 'Enter a number',
    ConfigComponent: FieldConfigNumber,
  },
};

/**
 * Categories for organizing field types in the add menu.
 */
export const FIELD_CATEGORIES: {
  id: string;
  labelKey: string;
  types: FieldType[];
}[] = [
  {
    id: 'text_audio_video',
    labelKey: 'Text, audio and video',
    types: ['short_text', 'long_text'],
  },
  {
    id: 'choice',
    labelKey: 'Choice',
    types: ['multiple_choice', 'dropdown', 'yes_no'],
  },
  {
    id: 'other',
    labelKey: 'Other',
    types: ['date', 'number'],
  },
];

export function getFieldIcon(type: FieldType): IconType {
  return FIELD_TYPE_REGISTRY[type].icon;
}

export function getFieldLabelKey(type: FieldType): string {
  return FIELD_TYPE_REGISTRY[type].labelKey;
}

export function getFieldPlaceholderKey(type: FieldType): string {
  return FIELD_TYPE_REGISTRY[type].placeholderKey;
}

export function getFieldConfigComponent(
  type: FieldType,
): ComponentType<FieldConfigProps> | undefined {
  return FIELD_TYPE_REGISTRY[type].ConfigComponent;
}
