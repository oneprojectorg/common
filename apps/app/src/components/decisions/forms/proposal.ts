import {
  type ProposalTemplateSchema,
  SYSTEM_FIELD_KEYS,
  type XFormat,
  getProposalTemplateFieldOrder,
} from '@op/common/client';

import type { FieldDescriptor } from './types';

const REQUIRED_SYSTEM_FIELDS = new Set(['title']);
const DEFAULT_X_FORMAT: XFormat = 'short-text';

/**
 * Compiles a proposal template into field descriptors for rendering.
 * Resolves `x-format` on each property and tags system fields (title, category, budget).
 */
export function compileProposalSchema(
  proposalTemplate: ProposalTemplateSchema,
): FieldDescriptor[] {
  const templateProperties = proposalTemplate.properties ?? {};

  for (const key of REQUIRED_SYSTEM_FIELDS) {
    if (!templateProperties[key]) {
      console.error(`[compileProposalSchema] Missing system field "${key}"`);
    }
  }

  const { all } = getProposalTemplateFieldOrder(proposalTemplate);

  return all.flatMap((key): FieldDescriptor[] => {
    const propSchema = templateProperties[key];
    if (!propSchema) {
      return [];
    }
    return [
      {
        key,
        format: propSchema['x-format'] ?? DEFAULT_X_FORMAT,
        isSystem: SYSTEM_FIELD_KEYS.has(key),
        schema: propSchema,
      },
    ];
  });
}
