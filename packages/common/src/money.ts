import { z } from 'zod';

/**
 * Canonical schema for a monetary amount.
 * `amount` is the numeric value; `currency` is an ISO 4217 code (e.g. "USD").
 */
export const moneyAmountSchema = z.object({
  amount: z.number(),
  currency: z.string(),
});

/** A monetary amount with currency. */
export type MoneyAmount = z.infer<typeof moneyAmountSchema>;

/** Fallback when neither a stored money value nor a template pins a currency. */
export const DEFAULT_MONEY_CURRENCY = 'USD';

// Cached — Intl.supportedValuesOf allocates a fresh array on every call.
let knownCurrencyCodes: Set<string> | undefined;

/** Whether a code is an ISO 4217 currency code, per the runtime's Intl registry. */
export function isValidCurrencyCode(code: unknown): code is string {
  if (typeof code !== 'string') {
    return false;
  }
  knownCurrencyCodes ??= new Set(Intl.supportedValuesOf('currency'));
  return knownCurrencyCodes.has(code.toUpperCase());
}

// Partial: unvalidated drafts may hold half-filled money values.
const partialMoneyAmountSchema = moneyAmountSchema.partial();

/** The amount inside a stored money value, or `null` when absent/malformed. */
export function getMoneyAmount(value: unknown): number | null {
  const parsed = partialMoneyAmountSchema.safeParse(value);
  const amount = parsed.success ? parsed.data.amount : undefined;
  // zod rejects NaN but lets Infinity through
  return amount !== undefined && Number.isFinite(amount) ? amount : null;
}

/** The currency inside a stored money value, when it is well-formed. */
export function getMoneyCurrency(value: unknown): string | undefined {
  const parsed = partialMoneyAmountSchema.safeParse(value);
  const currency = parsed.success ? parsed.data.currency : undefined;
  return isValidCurrencyCode(currency) ? currency : undefined;
}

// formatToParts, not string-stripping: locales with non-ASCII numerals would
// leave digits behind in the symbol.
export function getCurrencySymbol(currency: string): string {
  // Callers pass persisted values; Intl.NumberFormat throws on unknown codes,
  // which must not crash a render.
  if (!isValidCurrencyCode(currency)) {
    return currency;
  }
  const part = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  })
    .formatToParts(0)
    .find(({ type }) => type === 'currency');
  return part?.value ?? currency;
}
