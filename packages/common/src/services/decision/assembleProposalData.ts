import { extractBudgetValue, normalizeBudget } from './proposalDataSchema';
import type { ProposalTemplateSchema } from './types';

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
      case 'long-text':
      case 'dropdown':
        data[key] = text;
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
