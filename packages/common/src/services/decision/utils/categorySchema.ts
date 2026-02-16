/**
 * Shared helpers for building and reading category / dropdown JSON Schemas.
 *
 * Category fields use the `oneOf` pattern (`[{ const, title }]`) as the
 * canonical format.  A `{ const: null, title: '' }` sentinel is included
 * so that AJV accepts `null` (unselected) values against `type: ['string', 'null']`.
 *
 * Legacy templates stored categories as `{ enum: [..., null] }`.  The read
 * helpers (`parseSchemaOptions`) transparently fall back to `enum` so that
 * older data is still rendered correctly.
 */
import type { ProposalPropertySchema } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single selectable option extracted from a JSON Schema property. */
export interface SchemaOption {
  value: string;
  title: string;
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

/**
 * Build a category JSON Schema property from a list of category labels.
 *
 * @param categories  - Plain string labels (e.g. `['Infrastructure', 'Education']`).
 * @param existing    - The current schema for the field, if any. Existing
 *                      properties (like `title`) are preserved; the legacy
 *                      `enum` key is stripped.
 * @returns A JSON Schema object ready to be set as `properties.category`.
 */
export function buildCategorySchema(
  categories: string[],
  existing?: Record<string, unknown>,
): Record<string, unknown> {
  const { enum: _legacyEnum, ...rest } = existing ?? {};

  return {
    ...rest,
    type: ['string', 'null'],
    'x-format': 'dropdown',
    oneOf: [
      ...categories.map((c) => ({ const: c, title: c })),
      { const: null, title: '' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Parse selectable options from a JSON Schema property.
 *
 * Prefers the `oneOf` format (`[{ const, title }]`), falling back to a
 * legacy `enum` array for backwards compatibility with older templates.
 * The null sentinel (`{ const: null }`) and non-string values are filtered
 * out — callers receive only user-visible options.
 */
export function parseSchemaOptions(
  schema: ProposalPropertySchema | null | undefined,
): SchemaOption[] {
  if (!schema) {
    return [];
  }

  const { oneOf, enum: enumVal } = schema;

  if (Array.isArray(oneOf)) {
    return oneOf
      .filter(
        (entry): entry is { const: string; title: string } =>
          typeof entry === 'object' &&
          entry !== null &&
          'const' in entry &&
          typeof (entry as Record<string, unknown>).const === 'string' &&
          'title' in entry &&
          typeof (entry as Record<string, unknown>).title === 'string',
      )
      .map((entry) => ({ value: entry.const, title: entry.title }));
  }

  if (Array.isArray(enumVal)) {
    return enumVal
      .filter((val): val is string => typeof val === 'string')
      .map((val) => ({ value: val, title: val }));
  }

  return [];
}

/**
 * Check whether a JSON Schema property has selectable options.
 *
 * Returns `true` when the schema contains a non-empty `oneOf` array
 * (canonical format) **or** a non-empty `enum` array (legacy format),
 * with at least one non-null string value.
 */
export function schemaHasOptions(
  schema: ProposalPropertySchema | null | undefined,
): boolean {
  return parseSchemaOptions(schema).length > 0;
}
