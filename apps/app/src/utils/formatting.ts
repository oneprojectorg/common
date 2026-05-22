/**
 * Shared formatting utilities for consistent display across the application
 */
import {
  formatDate as formatDateCore,
  formatDateRange as formatDateRangeCore,
} from '@op/ui/utils/formatting';

/**
 * Locale every money value in the app is formatted with. Deliberately fixed
 * rather than the viewer's: an author editing a budget and a reviewer reading
 * it on a card must see the same number, and the amount is grouped/decimated
 * the same way wherever it appears.
 */
const DEFAULT_LOCALE = 'en-US';

/**
 * Format a currency amount, tolerating a malformed currency code.
 *
 * `currency` reaches us from stored proposal data, where it is only typed as a
 * string — a bad code (from an import or an older writer) makes
 * `Intl.NumberFormat` throw `RangeError` and blanks the surrounding page into
 * an error boundary. Fall back to a plain localized number instead: showing
 * the amount unlabeled beats fabricating the wrong symbol, and the bad code is
 * logged once so the record can be repaired.
 *
 * Every currency-styled `Intl` call on proposal data should go through this
 * (or {@link getCurrencySymbol}) rather than calling `Intl` directly.
 */
export function formatCurrency(
  amount: number,
  locale: string = DEFAULT_LOCALE,
  currency: string = 'USD',
): string {
  const fractionDigits = currencyFractionDigits(amount);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    reportInvalidCurrency(currency);
    // Deliberately drops the caller's locale. This branch exists to absorb a
    // throw, so it must not be able to throw itself, and a malformed `locale`
    // is one of the two things that can throw above.
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  }
}

/**
 * Whole amounts render without decimals, fractional ones with exactly two.
 *
 * `Intl`'s own default (min 0, max 2) renders 5000.5 as the malformed "$5,000.5"
 * — one decimal place, which no currency uses. Pinning min = max gives "$5,000"
 * and "$5,000.50" instead. Zero-decimal currencies (JPY, KRW) still round to
 * whole units because a fractional yen amount can't be entered in the first
 * place; the budget input is the only writer.
 */
function currencyFractionDigits(amount: number): 0 | 2 {
  return Number.isInteger(amount) ? 0 : 2;
}

/**
 * Render a stored `{amount, currency}` budget.
 *
 * The single entry point for budget display: every surface that shows a
 * proposal's budget (editor pill, list cards, detail page, review tables) goes
 * through this so the same budget can't render as "$5,000" in the editor and
 * "CA$5,000.50" on the card. Options live here rather than at the call sites
 * precisely because per-site option bags are what let them drift.
 */
export function formatMoney(budget: {
  amount: number;
  currency: string;
}): string {
  return formatCurrency(budget.amount, DEFAULT_LOCALE, budget.currency);
}

/**
 * Symbols `Intl` has no glyph for at {@link DEFAULT_LOCALE}, where it returns
 * the ISO code instead. Kept from the hand-written map this helper replaced so
 * the currency picker and the max-budget input don't regress to bare codes.
 *
 * Deliberately not a full map: every other supported code already resolves to
 * the same symbol the hand map carried, and CNY resolves to the better `CN¥`
 * (the old `¥` was indistinguishable from JPY).
 */
const CURRENCY_SYMBOL_OVERRIDES: Record<string, string> = {
  AED: 'د.إ',
  SAR: '﷼',
  SGD: 'S$',
};

/**
 * The currency symbol for a code (e.g. `"$"`, `"CA$"`). For prefixing an input
 * where the amount is rendered separately.
 *
 * Uses the default `currencyDisplay: 'symbol'`, not `'narrowSymbol'`: narrow
 * collapses CAD, AUD, SGD and MXN all to a bare `$`, so a currency picker
 * offering them lists four identical-looking entries and an admin configuring
 * a CAD process sees the same `$` prefix a USD one shows.
 *
 * Takes the symbol from `formatToParts` rather than stripping digits out of a
 * formatted string: `\d` matches ASCII only, so an Arabic or Bengali locale
 * would leave its zero in the "symbol" and render it beside the amount.
 * Defaults to the same locale as {@link formatCurrency} so an input's prefix
 * and the value rendered next to it can't disagree.
 *
 * Falls back to the code itself rather than `''` for a code `Intl` rejects: an
 * unlabeled amount reads as dollars to most users, and the input this prefixes
 * would otherwise render with no currency marker at all.
 */
export function getCurrencySymbol(
  currency: string,
  locale: string = DEFAULT_LOCALE,
): string {
  const override = CURRENCY_SYMBOL_OVERRIDES[currency];
  if (override && locale === DEFAULT_LOCALE) {
    return override;
  }

  try {
    return (
      new Intl.NumberFormat(locale, { style: 'currency', currency })
        .formatToParts(0)
        .find((part) => part.type === 'currency')
        ?.value.trim() || currency
    );
  } catch {
    reportInvalidCurrency(currency);
    return currency;
  }
}

/**
 * Bad currency codes already reported, so a list render logs each one once.
 * Bounded because `currency` is user-supplied (`budgetValueSchema` types it as
 * a bare string) and this module is reachable from long-lived server
 * processes.
 *
 * Past the cap the oldest key is evicted rather than the newest refused:
 * refusing to insert would stop deduping the very code being reported, so a
 * 51st bad code would fire a PostHog warning on every render of every row.
 * `Set` preserves insertion order, so its first key is the oldest.
 */
const reportedInvalidCurrencies = new Set<string>();
const MAX_REPORTED_CURRENCIES = 50;

function reportInvalidCurrency(currency: string) {
  if (reportedInvalidCurrencies.has(currency)) {
    return;
  }

  if (reportedInvalidCurrencies.size >= MAX_REPORTED_CURRENCIES) {
    const oldest = reportedInvalidCurrencies.values().next().value;
    if (oldest !== undefined) {
      reportedInvalidCurrencies.delete(oldest);
    }
  }
  reportedInvalidCurrencies.add(currency);
  // Imported lazily: this module is reachable from server components, and the
  // client logger pulls in `posthog-js` at module scope.
  void import('@op/logging/client')
    .then(({ logger }) =>
      logger.warn('Unsupported currency code in stored data', { currency }),
    )
    .catch(() => {
      // Reporting must never break rendering.
    });
}

/**
 * Format single date using locale-aware formatting
 */
export function formatDate(
  dateString: string | null | undefined,
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
): string {
  if (!dateString) {
    return formatDate(new Date().toISOString(), locale, options);
  }

  // Use the UI package utility for consistent timezone-safe date parsing
  return formatDateCore(dateString, options, locale);
}

/**
 * Format date range for phases and events
 */
export function formatDateRange(
  startDate?: string,
  endDate?: string,
  locale: string = 'en-US',
): string {
  // Use the UI package utility for consistent timezone-safe date parsing
  return formatDateRangeCore(startDate, endDate, locale);
}

/**
 * Calculate days remaining from end date
 */
export function calculateDaysRemaining(endDate?: string): number | null {
  if (!endDate) return null;

  const end = new Date(endDate);
  const today = new Date();
  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Date-time format options for UTC timestamps
 * Used with next-intl's useFormatter().dateTime()
 */
export const DATE_TIME_UTC_FORMAT = {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
} as const;
