/**
 * Budget add-up (`x-format: 'money-group'`) readers.
 *
 * A budget add-up is **one** composite rubric criterion: an object-typed schema
 * property whose sub-properties are money line items plus a group-level
 * `currency` string carrying the template-set default. The stored answer is a
 * valid instance of that schema — line-item amounts plus the currency
 * materialized at fill time:
 *
 * ```json
 * { "a1b2c3": 12000, "d4e5f6": 3000, "currency": "USD" }
 * ```
 *
 * The **Total is never stored** — it is summed at render/read time, the same
 * philosophy as review scores. See `kb/adr/0003-budget-addup-derived-totals`.
 *
 * Every reader here excludes the reserved `currency` key when iterating line
 * items; callers should use these helpers rather than walking the object.
 */
import type { JSONSchema7 } from 'json-schema';

import type { XFormatPropertySchema } from './types';

/**
 * Reserved sub-property of a money group holding its ISO 4217 currency code.
 * Never a line item — mirrors the proposal budget field's shape.
 */
export const MONEY_GROUP_CURRENCY_KEY = 'currency';

/** Fallback when neither the answer nor the template declares a currency. */
export const DEFAULT_MONEY_GROUP_CURRENCY = 'USD';

/** One money line item of a budget add-up, in stored order. */
export interface MoneyLineItem {
  /** Opaque generated id — the key under which the amount is stored. */
  id: string;
  /** Admin-editable display label. */
  title: string;
  /** Listed in the group's nested `required` array. */
  required: boolean;
}

/** Narrows a JSON Schema definition to its object form. */
function isSchemaObject(
  definition: JSONSchema7 | boolean | undefined,
): definition is JSONSchema7 {
  return typeof definition === 'object' && definition !== null;
}

/** `true` when the property schema describes a budget add-up criterion. */
export function isMoneyGroupSchema(schema: XFormatPropertySchema): boolean {
  return schema['x-format'] === 'money-group' && schema.type === 'object';
}

/**
 * Money line items of a budget add-up, ordered by the group's nested
 * `x-field-order` with any unlisted properties appended. The reserved
 * `currency` property is never a line item.
 */
export function getMoneyGroupLineItems(
  schema: XFormatPropertySchema,
): MoneyLineItem[] {
  const properties = schema.properties ?? {};
  const declaredOrder = schema['x-field-order'] ?? [];

  const orderedIds: string[] = [];
  for (const id of [...declaredOrder, ...Object.keys(properties)]) {
    if (id === MONEY_GROUP_CURRENCY_KEY) continue;
    if (orderedIds.includes(id)) continue;
    if (!isSchemaObject(properties[id])) continue;
    orderedIds.push(id);
  }

  const required = new Set(schema.required ?? []);

  return orderedIds.map((id) => {
    const itemSchema = properties[id];
    const title =
      isSchemaObject(itemSchema) && typeof itemSchema.title === 'string'
        ? itemSchema.title
        : id;
    return { id, title, required: required.has(id) };
  });
}

/**
 * Currency of a budget add-up. The stored answer wins (each submitted review
 * stays self-describing even if the template's currency is later edited), then
 * the template default, then USD.
 *
 * Drafts are never schema-validated, so a stored currency is trusted only when
 * it is a well-formed ISO 4217 code — anything else falls back to the template
 * default rather than reaching `Intl.NumberFormat`, which throws on a malformed
 * code.
 */
export function getMoneyGroupCurrency(
  schema: XFormatPropertySchema,
  value?: unknown,
): string {
  const answerCurrency =
    readMoneyGroupObject(value)?.[MONEY_GROUP_CURRENCY_KEY];
  if (isCurrencyCode(answerCurrency)) {
    return answerCurrency;
  }

  const currencySchema = schema.properties?.[MONEY_GROUP_CURRENCY_KEY];
  if (isSchemaObject(currencySchema)) {
    // `const` pins the group to one currency; `default` is what the reviewer
    // form materializes into the answer.
    const declared = currencySchema.const ?? currencySchema.default;
    if (isCurrencyCode(declared)) {
      return declared;
    }
  }

  return DEFAULT_MONEY_GROUP_CURRENCY;
}

/** A well-formed ISO 4217 code — three letters, the shape `Intl` accepts. */
function isCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z]{3}$/.test(value);
}

/**
 * Amount stored for one line item, or `null` when unanswered. Anything
 * non-finite (string, null, NaN) reads as unanswered.
 */
export function getMoneyLineItemAmount(
  value: unknown,
  lineItemId: string,
): number | null {
  const amount = readMoneyGroupObject(value)?.[lineItemId];
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : null;
}

/**
 * Derived total of a budget add-up: the sum of the amounts of the line items
 * **declared by the schema**, which structurally excludes the `currency` key
 * and any stale ids. Unanswered line items contribute 0, so an untouched group
 * totals 0.
 */
export function sumMoneyGroupTotal(
  schema: XFormatPropertySchema,
  value: unknown,
): number {
  return getMoneyGroupLineItems(schema).reduce((total, lineItem) => {
    return total + (getMoneyLineItemAmount(value, lineItem.id) ?? 0);
  }, 0);
}

/**
 * Stored answer with one line item set to `amount` (or cleared when `null`),
 * materializing the group's `currency` alongside it — the answer stays a valid
 * instance of the group schema, and each submitted review keeps describing its
 * own currency. Reviewers never pick the currency; it comes from the template.
 */
export function setMoneyLineItemAmount(
  schema: XFormatPropertySchema,
  value: unknown,
  lineItemId: string,
  amount: number | null,
): Record<string, unknown> {
  const current = readMoneyGroupObject(value) ?? {};
  const next: Record<string, unknown> = {
    ...current,
    [MONEY_GROUP_CURRENCY_KEY]: getMoneyGroupCurrency(schema, value),
  };

  if (amount === null) {
    delete next[lineItemId];
  } else {
    next[lineItemId] = amount;
  }

  return next;
}

/** Narrows a stored answer to its object form. */
function readMoneyGroupObject(
  value: unknown,
): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
