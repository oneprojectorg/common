/**
 * Money fields on JSON Schema templates: a normal template property whose
 * answer is an amount in the unit the field declares (ADR 0005). Two shapes
 * are valid.
 *
 * Currency-kind — the amount is money, and `properties.currency` pins the
 * code:
 *
 * ```json
 * {
 *   "type": "object",
 *   "title": "Estimated Cost",
 *   "x-format": "money",
 *   "x-unit": { "kind": "currency", "code": "EUR" },
 *   "properties": {
 *     "amount": { "type": "number", "minimum": 0 },
 *     "currency": { "type": "string", "const": "EUR", "default": "EUR" }
 *   },
 *   "required": ["amount", "currency"],
 *   "additionalProperties": false
 * }
 * ```
 *
 * Custom-kind — the amount is counted in anything else, so there is no
 * `currency` property and `required` lists only `amount`:
 *
 * ```json
 * {
 *   "type": "object",
 *   "title": "Cost",
 *   "x-format": "money",
 *   "x-unit": { "kind": "custom", "label": "points" },
 *   "properties": { "amount": { "type": "number", "minimum": 0 } },
 *   "required": ["amount"],
 *   "additionalProperties": false
 * }
 * ```
 *
 * `x-format: 'money'` selects the renderer; AJV validates answers against
 * whatever the template declares, so authors must declare exactly one of
 * these shapes. Totals are derived at render time, never stored.
 *
 * The helpers below are currency-only and serve rubric money criteria, which
 * do not take custom units. `getFieldUnit` in `../budgetUnit` is what reads a
 * field's unit.
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
