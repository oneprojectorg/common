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

function isPlainObject(value: unknown): value is { [key: string]: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The amount inside a stored money value, or `null` when absent/malformed. */
export function getMoneyAmount(value: unknown): number | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const amount = value.amount;
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : null;
}

/** The currency inside a stored money value, when it is well-formed. */
export function getMoneyCurrency(value: unknown): string | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }
  return isValidCurrencyCode(value.currency) ? value.currency : undefined;
}

// formatToParts, not string-stripping: locales with non-ASCII numerals would
// leave digits behind in the symbol.
export function getCurrencySymbol(currency: string): string {
  const part = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  })
    .formatToParts(0)
    .find(({ type }) => type === 'currency');
  return part?.value ?? currency;
}
