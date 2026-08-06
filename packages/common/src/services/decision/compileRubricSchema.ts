import type {
  RubricTemplateSchema,
  XFormat,
  XFormatPropertySchema,
} from './types';

const DEFAULT_X_FORMAT: XFormat = 'short-text';

/**
 * A compiled field descriptor produced by a schema compiler. Describes a
 * single field with everything needed to render it.
 */
export interface FieldDescriptor {
  /** Property key in the schema (e.g. "title", "summary"). */
  key: string;
  /** Resolved display format. */
  format: XFormat;
  /** The raw property schema definition for this field. */
  schema: XFormatPropertySchema;
  /** Whether this is a system field (title, category, budget). Only relevant for proposals. */
  isSystem?: boolean;
  /** Whether this field is listed in the schema's `required` array. */
  required?: boolean;
}

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
  const requiredSet = new Set(template.required ?? []);
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
    required: requiredSet.has(key),
    schema: properties[key] as XFormatPropertySchema,
  }));
}
