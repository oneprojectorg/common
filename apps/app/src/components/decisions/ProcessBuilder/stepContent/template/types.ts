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
  | 'video'
  | 'audio'
  // Choice
  | 'multiple_choice'
  | 'dropdown'
  | 'yes_no'
  // Other
  | 'file_upload'
  | 'date'
  | 'number'
  | 'section';

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
  options?: string[];
  /** Placeholder text for text inputs */
  placeholder?: string;
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
