/**
 * Money fields on JSON Schema templates.
 *
 * A money field is a *normal* template property whose value is an object,
 * mirroring the proposal budget field's shape:
 *
 * ```json
 * {
 *   "type": "object",
 *   "title": "Design & Engineering Cost",
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
 * Being a normal property is the whole point: one top-level key, one answer,
 * one rationale, AJV enforcing `minimum` / `required` / `const` for free, and
 * `additionalProperties: false` making a smuggled `total` key unstorable.
 *
 * That shape is not optional. `x-format: 'money'` alone is enough to select the
 * money renderer, so a template that declares the format without the shape
 * would render an input whose answers AJV then rejects — a form that can never
 * be submitted. {@link assertMoneyFieldSchemas} rejects such a template at the
 * persistence boundary, and every reader below only trusts a schema that would
 * pass it.
 *
 * Totals over a group of money fields are **derived at render time, never
 * stored** — the same philosophy as review scores.
 */
import { ValidationError } from '../../utils';
import type { SectionableTemplate } from './templateSections';
import type { XFormatPropertySchema } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stored answer for a money field. */
export interface MoneyFieldAnswer {
  amount: number;
  currency: string;
}

/**
 * Currency used when a *reader* has nothing better to go on (an unvalidated
 * draft answer under a template that predates the authoring guard). Never used
 * to paper over invalid authoring — see {@link assertMoneyFieldSchemas}.
 */
export const DEFAULT_MONEY_CURRENCY = 'USD';

/** ISO 4217 codes are three letters. Stored drafts are unvalidated. */
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

/**
 * Whether a property is a money field. Detection is **declared only** — the
 * `x-format` key — never structural, so it cannot reclassify an existing
 * scored / yes-no / single-select criterion.
 */
export function isMoneyFieldSchema(schema: XFormatPropertySchema): boolean {
  return schema['x-format'] === 'money';
}

/**
 * The currency a money field is pinned to by its template author: the
 * `currency` sub-property's `const`, else its `default`. `undefined` when the
 * template declares neither, or declares something malformed — a template that
 * passed {@link assertMoneyFieldSchemas} always yields a value here.
 */
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
// Answer readers (drafts are unvalidated — every read is defensive)
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

/**
 * Currency to *display* a stored answer in: the stored code when well-formed,
 * else the template's declared currency, else {@link DEFAULT_MONEY_CURRENCY}.
 * Stored wins so a submitted review keeps reading in the currency it was filled
 * in, even after the template is re-pinned. Also guards `Intl.NumberFormat`
 * against garbage in unvalidated drafts.
 */
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

/**
 * Build the answer to store for a money field. The currency is materialized
 * from the template at fill time, so a submitted review stays self-describing
 * even if the template's currency is edited later. Reviewers never pick one.
 */
export function buildMoneyFieldAnswer(
  amount: number,
  schema: XFormatPropertySchema,
): MoneyFieldAnswer {
  return {
    amount,
    currency: getMoneyFieldCurrency(schema) ?? DEFAULT_MONEY_CURRENCY,
  };
}

// ---------------------------------------------------------------------------
// Template-authoring guards
// ---------------------------------------------------------------------------

/**
 * Every declared money property must carry the exact storage shape documented
 * at the top of this file. AJV validates *answers* against whatever the
 * template says; it cannot know that the money renderer will produce
 * `{ amount, currency }`. Without this guard a template can be persisted whose
 * money fields render an input nobody can ever submit (missing `currency`
 * property plus `additionalProperties: false`), or that silently accepts a
 * stored `total` (missing `additionalProperties: false`).
 *
 * @throws ValidationError naming the offending property and requirement.
 */
export function assertMoneyFieldSchemas(
  template: SectionableTemplate & {
    properties?: Record<string, XFormatPropertySchema | boolean>;
  },
): void {
  for (const [key, definition] of Object.entries(template.properties ?? {})) {
    if (!isSchemaObjectDefinition(definition)) {
      continue;
    }
    if (!isMoneyFieldSchema(definition)) {
      continue;
    }

    const problem = findMoneyFieldSchemaProblem(definition);
    if (problem) {
      throw new ValidationError(
        `Money field "${key}" has an invalid schema: ${problem}`,
        { [key]: problem },
      );
    }
  }
}

/**
 * Returns a human-readable description of the first shape requirement a
 * declared money field breaks, or `undefined` when it is well-formed.
 */
function findMoneyFieldSchemaProblem(
  schema: XFormatPropertySchema,
): string | undefined {
  if (schema.type !== 'object') {
    return "type must be 'object'";
  }

  if (schema.additionalProperties !== false) {
    return 'additionalProperties must be false';
  }

  const required = schema.required ?? [];
  for (const key of ['amount', 'currency']) {
    if (!required.includes(key)) {
      return `required must include '${key}'`;
    }
  }

  const amount = schema.properties?.amount;
  if (!isSchemaObjectDefinition(amount)) {
    return "an 'amount' property is required";
  }
  if (amount.type !== 'number') {
    return "amount.type must be 'number'";
  }
  if (amount.minimum !== 0) {
    return 'amount.minimum must be 0';
  }

  const currency = schema.properties?.currency;
  if (!isSchemaObjectDefinition(currency)) {
    return "a 'currency' property is required";
  }
  if (currency.type !== 'string') {
    return "currency.type must be 'string'";
  }
  if (!isValidCurrencyCode(currency.const)) {
    return 'currency.const must be a three-letter ISO 4217 code';
  }
  if (currency.default !== currency.const) {
    return 'currency.default must equal currency.const';
  }

  return undefined;
}
