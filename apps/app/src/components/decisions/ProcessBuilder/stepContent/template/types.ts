import type { SortableItem } from '@op/ui/Sortable';

/**
 * Form Builder Types
 *
 * Defines the data structures for the proposal template form builder.
 * These types are used to configure what fields appear in the proposal submission form.
 */

/**
 * All supported field types for the form builder.
 * Organized by category as shown in the UI.
 */
export type FieldType =
  // Text, audio and video
  | 'short_text'
  | 'long_text'
  // Choice
  | 'multiple_choice'
  | 'dropdown'
  | 'yes_no'
  // Other
  | 'date'
  | 'number';

/**
 * An option for dropdown/multiple choice fields.
 * Extends SortableItem for drag-and-drop reordering support.
 */
export interface FieldOption extends SortableItem {
  /** Unique identifier for the option */
  id: string;
  /** Display value for the option */
  value: string;
}

/**
 * Configuration for a single form field.
 */
export interface FormField {
  /** Unique identifier for the field */
  id: string;
  /** The type of field to render */
  type: FieldType;
  /** Display label for the field */
  label: string;
  /** Whether the field is required for submission */
  required?: boolean;
  /** Whether the field is a system field that cannot be removed */
  locked?: boolean;
  /** Options for dropdown/multiple choice fields */
  options?: FieldOption[];
  /** Placeholder text for text inputs */
  placeholder?: string;
  /** Description/guidance text for participants */
  description?: string;
  /** Minimum value for number fields */
  min?: number;
  /** Maximum value for number fields */
  max?: number;
  /** Whether the number field represents a dollar amount */
  isCurrency?: boolean;
}

/**
 * Complete form builder configuration stored in the process instance.
 */
export interface FormBuilderConfig {
  /** Ordered list of fields in the form */
  fields: FormField[];
}

/**
 * Field category for grouping in the add field menu.
 */
export interface FieldCategory {
  /** Unique identifier for the category */
  id: string;
  /** Translation key for the category label */
  labelKey: string;
  /** Field types belonging to this category */
  types: FieldType[];
}

/**
 * Configuration for a field type in the registry.
 */
export interface FieldTypeConfig {
  /** Translation key for the field type label */
  labelKey: string;
  /** Default placeholder text translation key */
  placeholderKey: string;
}
