import type {
  RubricTemplateSchema,
  XFormat,
  XFormatPropertySchema,
} from '@op/common/client';

import type { ProposalFieldDescriptor } from '../../../proposalEditor/compileProposalSchema';

/** Default `x-format` when a rubric field omits the extension. */
const DEFAULT_X_FORMAT: XFormat = 'short-text';

/**
 * Compiles a rubric template schema into field descriptors for rendering.
 *
 * Same shape as `compileProposalSchema` output, but without system-field
 * handling — all rubric criteria are treated as dynamic fields.
 * Respects `x-field-order` for ordering, falls back to property order.
 */
export function compileRubricSchema(
  rubricTemplate: RubricTemplateSchema,
): ProposalFieldDescriptor[] {
  const properties = rubricTemplate.properties ?? {};

  if (Object.keys(properties).length === 0) {
    return [];
  }

  const fieldOrder = rubricTemplate['x-field-order'] ?? [];

  // Ordered keys: explicit order first, then any remaining properties
  const seen = new Set<string>();
  const orderedKeys: string[] = [];

  for (const key of fieldOrder) {
    if (!seen.has(key) && properties[key]) {
      seen.add(key);
      orderedKeys.push(key);
    }
  }
  for (const key of Object.keys(properties)) {
    if (!seen.has(key)) {
      seen.add(key);
      orderedKeys.push(key);
    }
  }

  return orderedKeys.map((key) => {
    const propSchema = properties[key] as XFormatPropertySchema;
    return {
      key,
      format: propSchema['x-format'] ?? DEFAULT_X_FORMAT,
      isSystem: false,
      schema: propSchema,
    };
  });
}
