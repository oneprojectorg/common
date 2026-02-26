import type {
  RubricTemplateSchema,
  XFormat,
  XFormatPropertySchema,
} from '@op/common/client';

import type { FieldDescriptor } from './types';

const DEFAULT_X_FORMAT: XFormat = 'short-text';

/**
 * Compiles a rubric template schema into field descriptors for rendering.
 *
 * Similar to `compileProposalSchema` but without system-field handling —
 * all rubric criteria are treated as dynamic fields.
 */
export function compileRubricSchema(
  template: RubricTemplateSchema,
): FieldDescriptor[] {
  const properties = template.properties ?? {};
  const propertyKeys = Object.keys(properties);

  if (propertyKeys.length === 0) {
    return [];
  }

  const fieldOrder = template['x-field-order'] ?? [];
  const seen = new Set<string>();
  const orderedKeys: string[] = [];

  for (const key of [...fieldOrder, ...propertyKeys]) {
    if (!seen.has(key) && properties[key]) {
      seen.add(key);
      orderedKeys.push(key);
    }
  }

  return orderedKeys.map((key) => ({
    key,
    format:
      (properties[key] as XFormatPropertySchema)['x-format'] ??
      DEFAULT_X_FORMAT,
    schema: properties[key] as XFormatPropertySchema,
  }));
}
