import type { JSONSchema7 } from 'json-schema';

/**
 * Builds the flat data object that the JSON Schema validator expects from
 * raw TipTap fragment text values.
 *
 * - Text fields (`short-text`, `long-text`, `title`): pass through as string
 * - Category fields: pass through as string
 * - Money fields: `JSON.parse` the fragment (stored as `{"amount":N,"currency":"..."}`)
 * - Everything else with no `x-format`: attempt `JSON.parse`, fall back to string
 */
export function assembleProposalData(
  template: JSONSchema7,
  fragmentTexts: Record<string, string>,
): Record<string, unknown> {
  const properties = template.properties as
    | Record<string, Record<string, unknown>>
    | undefined;

  if (!properties) {
    return {};
  }

  const data: Record<string, unknown> = {};

  for (const [key, schema] of Object.entries(properties)) {
    const text = fragmentTexts[key];
    if (text === undefined || text === '') {
      continue;
    }

    const format = schema['x-format'] as string | undefined;

    if (
      format === 'short-text' ||
      format === 'long-text' ||
      format === 'category'
    ) {
      data[key] = text;
    } else if (format === 'money') {
      try {
        const parsed = JSON.parse(text);
        // If schema expects a plain number (legacy), extract amount from {amount, currency}
        if (
          schema.type === 'number' &&
          typeof parsed === 'object' &&
          parsed !== null &&
          'amount' in parsed
        ) {
          data[key] = parsed.amount;
        } else {
          data[key] = parsed;
        }
      } catch {
        data[key] = text;
      }
    } else {
      // Unknown format — try JSON parse, fall back to raw string
      try {
        data[key] = JSON.parse(text);
      } catch {
        data[key] = text;
      }
    }
  }

  return data;
}
