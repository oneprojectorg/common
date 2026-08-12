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
 * Deliberately module-private: {@link formatMoney} is the only entry point, so
 * a new caller can't reintroduce the per-site option bags (or a per-site
 * locale) that made the same budget render differently on two surfaces.
 */
function formatCurrency(amount: number, currency: string): string {
  // Whole amounts render without decimals ("$5,000", not "$5,000.00"). Only
  // that case needs an override: for a fractional amount `Intl` already
  // defaults both bounds to the number of decimals the currency actually has,
  // so JPY 1000.5 gives "¥1,001" and USD 5000.5 gives "$5,000.50" on its own.
  const wholeAmountDigits = Number.isInteger(amount)
    ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
    : {};

  try {
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: 'currency',
      currency,
      ...wholeAmountDigits,
    }).format(amount);
  } catch {
    reportInvalidCurrency(currency);
    // `maximumFractionDigits` spelled out: without `style: 'currency'` there is
    // no currency to take a decimal count from, and the plain-number default is
    // 3 — so a fallback left to `Intl` renders 5000.567 as "5,000.567" rather
    // than the money-shaped two places.
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      maximumFractionDigits: 2,
      ...wholeAmountDigits,
    }).format(amount);
  }
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
  return formatCurrency(budget.amount, budget.currency);
}

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
 * formatted string: `\d` matches ASCII only, so a locale with non-ASCII digits
 * would leave its zero in the "symbol" and render it beside the amount.
 * Resolves through the same `Intl` call at the same {@link DEFAULT_LOCALE} that
 * {@link formatMoney} renders with, so an input's prefix and the value beside
 * it can't disagree. That rules out a hand-written override map: prettier
 * glyphs for the codes `Intl` spells out (`S$` for SGD, `د.إ` for AED) would
 * put `S$` in front of the input and `SGD 5,000` in the pill that replaces it.
 *
 * Falls back to the code itself rather than `''` for a code `Intl` rejects: an
 * unlabeled amount reads as dollars to most users, and the input this prefixes
 * would otherwise render with no currency marker at all.
 */
export function getCurrencySymbol(currency: string): string {
  try {
    return (
      new Intl.NumberFormat(DEFAULT_LOCALE, { style: 'currency', currency })
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
 * Bad currency codes already reported, so rendering a list logs each one once
 * rather than once per row. Unbounded is fine: the keys are ISO 4217 codes off
 * stored budgets, and a process that manages to store thousands of distinct
 * malformed ones has a bigger problem than this Set.
 */
const reportedInvalidCurrencies = new Set<string>();

function reportInvalidCurrency(currency: string) {
  if (reportedInvalidCurrencies.has(currency)) {
    return;
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
