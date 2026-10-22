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
import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';

import {
  DEFAULT_MONEY_CURRENCY,
  type MoneyAmount,
  getMoneyCurrency,
  isValidCurrencyCode,
} from '../../../money';
import type { XFormatPropertySchema } from '../types';

/** Narrows a JSON Schema definition to its object form (not `true`/`false`). */
function isSchemaObjectDefinition(
  definition: JSONSchema7Definition | undefined,
): definition is JSONSchema7 {
  return typeof definition === 'object' && definition !== null;
}

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

/** Declared `amount.minimum`, when the money schema is well-formed. */
export function getMoneyFieldMinimum(
  schema: XFormatPropertySchema,
): number | undefined {
  const amount = schema.properties?.amount;
  return isSchemaObjectDefinition(amount) ? amount.minimum : undefined;
}

/** Display currency: stored value wins (survives template re-pinning), then template, then USD. */
export function resolveMoneyDisplayCurrency(
  value: unknown,
  schema: XFormatPropertySchema,
): string {
  return (
    getMoneyCurrency(value) ??
    getMoneyFieldCurrency(schema) ??
    DEFAULT_MONEY_CURRENCY
  );
}

/** The answer to store: the template currency is stamped in at fill time, never reviewer-picked. */
export function buildMoneyFieldAnswer(
  amount: number,
  schema: XFormatPropertySchema,
): MoneyAmount {
  return {
    amount,
    currency: getMoneyFieldCurrency(schema) ?? DEFAULT_MONEY_CURRENCY,
  };
}
