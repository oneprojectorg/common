/**
 * Template editor types.
 *
 * FieldType and ProposalTemplate are now defined in @op/common.
 * This file keeps UI-only types used by the builder (AddFieldMenu, registry).
 */
export type { FieldType } from '@op/common';

/**
 * Field category for grouping in the add field menu.
 */
export interface FieldCategory {
  id: string;
  labelKey: string;
  types: import('@op/common').FieldType[];
}

/**
 * Configuration for a field type in the registry.
 */
export interface FieldTypeConfig {
  labelKey: string;
  placeholderKey: string;
}
