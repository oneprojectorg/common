/**
 * Template editor types.
 *
 * FieldType and ProposalTemplate are defined in decisions/proposalTemplate.ts.
 * This file keeps UI-only types used by the builder (AddFieldMenu, registry).
 */
export type { FieldType } from '../../../proposalTemplate';

/**
 * Field category for grouping in the add field menu.
 */
export interface FieldCategory {
  id: string;
  labelKey: string;
  types: import('../../../proposalTemplate').FieldType[];
}

/**
 * Configuration for a field type in the registry.
 */
export interface FieldTypeConfig {
  labelKey: string;
  placeholderKey: string;
}
