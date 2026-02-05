import type { IconType } from 'react-icons';
import {
  LuAlignLeft,
  LuCalendar,
  LuChevronDown,
  LuFilePlus,
  LuHash,
  LuLetterText,
  LuListChecks,
  LuMic,
  LuSquare,
  LuToggleLeft,
  LuVideo,
} from 'react-icons/lu';

import type { FieldCategory, FieldType, FieldTypeConfig } from './types';

/**
 * Configuration for each field type including icon and labels.
 */
interface FieldTypeRegistryEntry extends FieldTypeConfig {
  /** Icon component for the field type */
  icon: IconType;
}

/**
 * Registry mapping field types to their configuration.
 */
export const FIELD_TYPE_REGISTRY: Record<FieldType, FieldTypeRegistryEntry> = {
  // Text, audio and video
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
  video: {
    icon: LuVideo,
    labelKey: 'Video',
    placeholderKey: 'Video URL',
  },
  audio: {
    icon: LuMic,
    labelKey: 'Audio',
    placeholderKey: 'Audio URL',
  },
  // Choice
  multiple_choice: {
    icon: LuListChecks,
    labelKey: 'Multiple choice',
    placeholderKey: 'Select options',
  },
  dropdown: {
    icon: LuChevronDown,
    labelKey: 'Dropdown',
    placeholderKey: 'Select an option',
  },
  yes_no: {
    icon: LuToggleLeft,
    labelKey: 'Yes/no',
    placeholderKey: 'Yes or No',
  },
  // Other
  attachments: {
    icon: LuFilePlus,
    labelKey: 'Attachments',
    placeholderKey: 'Attach files',
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
  },
  section: {
    icon: LuSquare,
    labelKey: 'Section',
    placeholderKey: 'Section divider',
  },
};

/**
 * Categories for organizing field types in the add menu.
 */
export const FIELD_CATEGORIES: FieldCategory[] = [
  {
    id: 'text_audio_video',
    labelKey: 'Text, audio and video',
    types: ['short_text', 'long_text', 'video', 'audio'],
  },
  {
    id: 'choice',
    labelKey: 'Choice',
    types: ['multiple_choice', 'dropdown', 'yes_no'],
  },
  {
    id: 'other',
    labelKey: 'Other',
    types: ['attachments', 'date', 'number', 'section'],
  },
];

/**
 * Get the icon component for a field type.
 */
export function getFieldIcon(type: FieldType): IconType {
  return FIELD_TYPE_REGISTRY[type].icon;
}

/**
 * Get the display label key for a field type.
 */
export function getFieldLabelKey(type: FieldType): string {
  return FIELD_TYPE_REGISTRY[type].labelKey;
}

/**
 * Get the placeholder key for a field type.
 */
export function getFieldPlaceholderKey(type: FieldType): string {
  return FIELD_TYPE_REGISTRY[type].placeholderKey;
}
