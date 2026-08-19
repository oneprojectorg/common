import type { JSONSchema7 } from 'json-schema';

import type { RubricTemplateSchema, XFormatPropertySchema } from './types';

/**
 * The rubric criterion kinds supported by the builder and renderers.
 * Inferred from schema shape via {@link inferCriterionType}.
 */
export type RubricCriterionType =
  | 'scored'
  | 'yes_no'
  | 'single_select'
  | 'long_text';

/**
 * Extract oneOf entries as typed `JSONSchema7[]`, filtering out boolean
 * definitions.
 */
export function getOneOfEntries(schema: XFormatPropertySchema): JSONSchema7[] {
  if (!Array.isArray(schema.oneOf)) {
    return [];
  }
  return schema.oneOf.filter(
    (entry): entry is JSONSchema7 => typeof entry !== 'boolean',
  );
}

/**
 * Infer the `RubricCriterionType` from a raw JSON Schema property.
 */
export function inferCriterionType(
  schema: XFormatPropertySchema,
): RubricCriterionType | undefined {
  const xFormat = schema['x-format'];

  if (xFormat === 'long-text') {
    return 'long_text';
  }

  if (xFormat === 'dropdown') {
    if (schema.type === 'integer' && schema.maximum != null) {
      return 'scored';
    }

    if (schema.type === 'string') {
      const values = getOneOfEntries(schema).map((e) => e.const);
      if (
        values.length === 2 &&
        values.includes('yes') &&
        values.includes('no')
      ) {
        return 'yes_no';
      }

      // Any other string dropdown with options is a single-select
      // "multiple choice" criterion. Note the overall recommendation field
      // matches this shape too — callers exclude it by key before relying
      // on the inferred type.
      if (values.some((value) => typeof value === 'string')) {
        return 'single_select';
      }
    }
  }

  return undefined;
}

export function getCriterionMaxPoints(
  template: RubricTemplateSchema,
  criterionId: string,
): number | undefined {
  const schema = template.properties?.[criterionId];
  if (!schema || schema.type !== 'integer') {
    return undefined;
  }
  return schema.maximum;
}
