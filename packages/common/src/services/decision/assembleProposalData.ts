import {
  type BudgetData,
  parseBudgetFragmentValue,
  parseCategoryFragmentValue,
  schemaAllowsMultipleSelection,
} from './proposalDataSchema';
import { getBudgetCurrency } from './templateBudget';
import type { ProposalTemplateSchema } from './types';

/** System field key holding the proposal's requested budget. */
const BUDGET_FIELD_KEY = 'budget';

/** System field key holding the proposal's title. */
const TITLE_FIELD_KEY = 'title';

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
      case 'money': {
        // The same parser display reads the fragment with, so a budget the
        // editor renders can always be submitted. `normalizeBudget` alone
        // rejects the string-amount shape (`{"amount":"5000"}`) that
        // hand-written documents carry: on an object template that put the raw
        // JSON *string* in front of AJV ("budget is invalid", with nothing on
        // screen looking invalid), and on a legacy `{type:'number'}` one
        // `extractBudgetValue` quietly returned 0 while the pill still read
        // €5,000.
        const budget = parseBudgetFragmentValue(
          text,
          getBudgetCurrency(schema),
        );
        // Unreadable: hand AJV the raw text so it fails cleanly rather than
        // dropping the field and reporting a required budget as missing.
        // Legacy schemas use `type: 'number'`, so give them the bare amount to
        // range check against `maximum` — that is where the currency is lost,
        // and why renderers read the fragment directly.
        data[key] = !budget
          ? text
          : schema.type === 'number'
            ? budget.amount
            : budget;
        break;
      }
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

/**
 * System field values resolved from a proposal's document fragments, for
 * display. Each key is present only when the document carries a usable value,
 * so callers can spread this over `proposalData` to override it.
 */
export interface ProposalSystemFieldOverrides {
  title?: string;
  budget?: BudgetData;
}

/**
 * Resolves the system fields (`title`, `budget`) carried by a proposal's
 * document fragments — the source of truth for submitted proposals, where
 * `proposalData` may still hold creation-time values.
 *
 * Both are read from the raw fragment text rather than from
 * {@link assembleProposalData}'s output, which is shaped for the JSON-schema
 * validator rather than for display: it reduces the money fragment to a bare
 * number on legacy `{type: 'number'}` templates so AJV can range check it
 * against `maximum` (dropping the currency), and JSON-parses fields with no
 * `x-format` (turning an all-digits title into a number). The fragments carry
 * the author's exact title and a `{amount, currency}` budget for legacy and
 * canonical templates alike.
 *
 * A fragment that holds no usable value leaves the key absent so
 * `proposalData` stands: an unreadable fragment means we don't know the
 * author's intent, not that they cleared the field (clearing deletes the
 * fragment, which also lands here), and the stored value is the last one we
 * can trust.
 *
 * Callers pass the system fragments they extracted plus the template's
 * configured currency, which fragments that name no currency of their own fall
 * back to (see {@link parseBudgetFragmentValue}); the fragment set itself is
 * already gated on the template (see `getProposalFragmentNames`), so no other
 * template lookup is needed here.
 *
 * Shared by the client's `resolveProposalSystemFields` and the server's
 * `buildProposalListPreview` so a proposal cannot render one budget on a list
 * card and another on its detail page.
 */
export function resolveSystemFieldOverrides(
  fragmentTexts: Record<string, string>,
  budgetCurrency?: string,
): ProposalSystemFieldOverrides {
  const overrides: ProposalSystemFieldOverrides = {};

  // Straight from the fragment text, not via `assembleProposalData`: a title
  // on a template with no `x-format` goes through its `JSON.parse` branch, so
  // an all-digits title becomes a number and re-stringifying it rewrites what
  // the author typed ("2024.10" → "2024.1", "1e3" → "1000"). The trimmed
  // fragment text is the exact submitted title for every template shape.
  const title = (fragmentTexts[TITLE_FIELD_KEY] ?? '').trim();
  if (title) {
    overrides.title = title;
  }

  const budget = parseBudgetFragmentValue(
    fragmentTexts[BUDGET_FIELD_KEY] ?? '',
    budgetCurrency,
  );
  if (budget) {
    overrides.budget = budget;
  }

  return overrides;
}
