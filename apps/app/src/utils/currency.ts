/**
 * Currencies offered wherever an admin picks one (proposal budget field,
 * rubric budget add-ups) and the symbols used to prefix money inputs.
 */

export const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'JPY', symbol: '¥' },
  { code: 'CAD', symbol: 'CA$' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CHF', symbol: 'CHF' },
  { code: 'CNY', symbol: '¥' },
  { code: 'INR', symbol: '₹' },
  { code: 'BRL', symbol: 'R$' },
  { code: 'KRW', symbol: '₩' },
  { code: 'SGD', symbol: 'S$' },
  { code: 'MXN', symbol: 'MX$' },
  { code: 'AED', symbol: 'د.إ' },
  { code: 'SAR', symbol: '﷼' },
] as const;

export const CURRENCY_SYMBOL_MAP = new Map<string, string>(
  CURRENCIES.map((c) => [c.code, c.symbol]),
);

/** Symbol for an ISO 4217 code, falling back to `$` for unknown codes. */
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOL_MAP.get(currencyCode) ?? '$';
}
