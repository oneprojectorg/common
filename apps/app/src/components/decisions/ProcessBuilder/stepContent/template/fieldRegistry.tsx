import type { ComponentType } from 'react';
import type { IconType } from 'react-icons';
import { LuAlignLeft, LuChevronDown, LuLetterText } from 'react-icons/lu';

import type { XFormatPropertySchema } from '../../../proposalEditor/compileProposalSchema';
import type { FieldType, FieldView } from '../../../proposalTemplate';
import { FieldConfigDropdown } from './FieldConfigDropdown';

/**
 * Props passed to field config components.
 */
export interface FieldConfigProps {
  field: FieldView;
  fieldSchema: XFormatPropertySchema;
  onUpdateJsonSchema: (updates: Partial<XFormatPropertySchema>) => void;
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
  dropdown: {
    icon: LuChevronDown,
    labelKey: 'Dropdown',
    placeholderKey: 'Select an option',
    ConfigComponent: FieldConfigDropdown,
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
    types: ['dropdown'],
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
