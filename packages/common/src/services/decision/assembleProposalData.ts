import {
  extractBudgetValue,
  normalizeBudget,
  parseCategoryFragmentValue,
  schemaAllowsMultipleSelection,
} from './proposalDataSchema';
import type { ProposalTemplateSchema } from './types';

/**
 * Builds the flat data object that the JSON Schema validator expects from
 * raw TipTap fragment text values.
 *
 * - Text fields (`short-text`, `long-text`, `title`): pass through as string
 * - Category fields: pass through as string or parse JSON arrays for multi-select
 * - Money fields: `JSON.parse` the fragment (stored as `{"amount":N,"currency":"..."}`)
 * - Location fields: `JSON.parse` the fragment (stored as `{"lat":N,"lng":N}`)
 * - Everything else with no `x-format`: attempt `JSON.parse`, fall back to string
 */
export function assembleProposalData(
  template: ProposalTemplateSchema,
  fragmentTexts: Record<string, string>,
): Record<string, unknown> {
  const properties = template.properties;

  if (!properties) {
    return {};
  }

  const data: Record<string, unknown> = {};

  for (const [key, schema] of Object.entries(properties)) {
    const text = fragmentTexts[key];
    if (text === undefined || text === '') {
      continue;
    }

    switch (schema['x-format']) {
      case 'short-text':
      case 'long-text': {
        // Treat whitespace-only as empty so required text fields still
        // surface as missing rather than silently passing as "present".
        const trimmed = text.trim();
        if (!trimmed) {
          continue;
        }
        if (schemaAllowsMultipleSelection(schema)) {
          data[key] = parseCategoryFragmentValue(trimmed);
        } else {
          data[key] = trimmed;
        }
        break;
      }
      case 'dropdown':
        // The exact `const` from the schema's `oneOf` is what AJV matches.
        // Trimming here would silently strip whitespace that an author
        // baked into an option (often on the last one, where Enter / paste
        // is easy to typo) and downgrade a valid selection to "is invalid".
        if (schemaAllowsMultipleSelection(schema)) {
          data[key] = parseCategoryFragmentValue(text);
        } else {
          data[key] = text;
        }
        break;
      case 'location':
        // Raw-string fallback fails schema validation cleanly, same as money
        try {
          data[key] = JSON.parse(text);
        } catch {
          data[key] = text;
        }
        break;
      case 'money':
        try {
          const parsed = JSON.parse(text);
          // Legacy schemas use type: 'number' for budget — extract just the amount
          data[key] =
            schema.type === 'number'
              ? extractBudgetValue(parsed)
              : (normalizeBudget(parsed) ?? text);
        } catch {
          data[key] = text;
        }
        break;
      default:
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
