/**
 * Money fields on JSON Schema templates: a normal template property whose
 * answer is `{ amount, currency }` (the proposal budget shape):
 *
 * ```json
 * {
 *   "type": "object",
 *   "title": "Estimated Cost",
 *   "x-format": "money",
 *   "properties": {
 *     "amount": { "type": "number", "minimum": 0 },
 *     "currency": { "type": "string", "const": "USD", "default": "USD" }
 *   },
 *   "required": ["amount", "currency"],
 *   "additionalProperties": false
 * }
 * ```
 *
 * `x-format: 'money'` selects the renderer; AJV validates answers against
 * whatever the template declares, so authors must declare exactly this shape.
 * Totals are derived at render time, never stored.
 */
import type { XFormatPropertySchema } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stored answer for a money field. */
export interface MoneyFieldAnswer {
  amount: number;
  currency: string;
}

/** Reader fallback for unvalidated drafts. */
export const DEFAULT_MONEY_CURRENCY = 'USD';

/** ISO 4217 codes are three letters. */
const CURRENCY_CODE_PATTERN = /^[A-Za-z]{3}$/;

// ---------------------------------------------------------------------------
// Runtime narrowing (unknown JSON in, no assertions)
// ---------------------------------------------------------------------------

/** Narrows a JSON Schema definition to its object form (not `true`/`false`). */
export function isSchemaObjectDefinition(
  definition: XFormatPropertySchema | boolean | undefined,
): definition is XFormatPropertySchema {
  return typeof definition === 'object' && definition !== null;
}

/** Narrows an unknown stored value to a plain (non-array) object. */
function isPlainObject(value: unknown): value is { [key: string]: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether a code is shaped like an ISO 4217 currency code. */
export function isValidCurrencyCode(code: unknown): code is string {
  return typeof code === 'string' && CURRENCY_CODE_PATTERN.test(code);
}

// ---------------------------------------------------------------------------
// Schema readers
// ---------------------------------------------------------------------------

/** Declared-only detection — never structural, so legacy criteria can't be reclassified. */
export function isMoneyFieldSchema(schema: XFormatPropertySchema): boolean {
  return schema['x-format'] === 'money';
}

/** Template-pinned currency (`const`, else `default`); `undefined` when malformed. */
export function getMoneyFieldCurrency(
  schema: XFormatPropertySchema,
): string | undefined {
  const currencySchema = schema.properties?.currency;
  if (!isSchemaObjectDefinition(currencySchema)) {
    return undefined;
  }
  const declared = currencySchema.const ?? currencySchema.default;
  return isValidCurrencyCode(declared) ? declared : undefined;
}

// ---------------------------------------------------------------------------
// Answer readers (drafts are unvalidated, so every read is defensive)
// ---------------------------------------------------------------------------

/** The amount inside a stored money answer, or `null` when absent/malformed. */
export function getMoneyAnswerAmount(value: unknown): number | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const amount = value.amount;
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : null;
}

/** The currency inside a stored money answer, when it is well-formed. */
export function getMoneyAnswerCurrency(value: unknown): string | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }
  return isValidCurrencyCode(value.currency) ? value.currency : undefined;
}

/** Display currency: stored answer wins (survives template re-pinning), then template, then USD. */
export function resolveMoneyDisplayCurrency(
  value: unknown,
  schema: XFormatPropertySchema,
): string {
  return (
    getMoneyAnswerCurrency(value) ??
    getMoneyFieldCurrency(schema) ??
    DEFAULT_MONEY_CURRENCY
  );
}

/** The answer to store: the template currency is stamped in at fill time, never reviewer-picked. */
export function buildMoneyFieldAnswer(
  amount: number,
  schema: XFormatPropertySchema,
): MoneyFieldAnswer {
  return {
    amount,
    currency: getMoneyFieldCurrency(schema) ?? DEFAULT_MONEY_CURRENCY,
  };
}
