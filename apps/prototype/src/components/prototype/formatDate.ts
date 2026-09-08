/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * Phase dates are stored date-only ("2026-01-12"). `new Date()` reads those as
 * UTC midnight, so formatting them in a timezone behind UTC renders the day
 * before — "Jan 12" became "Jan 11". Formatting in UTC keeps the date as typed.
 */
export function formatShortDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatLongDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * "Sep 5 to Sep 10", the form the reorder dialog uses. Spelled out rather than
 * hyphenated because a dash between two dates reads as a minus sign at small
 * sizes, and this dialog is asking somebody to compare two of them.
 */
export function formatDateSpanWords(
  startDate: string,
  endDate: string,
  locale: string,
): string {
  const start = formatShortDate(startDate, locale);

  return startDate === endDate
    ? start
    : `${start} to ${formatShortDate(endDate, locale)}`;
}
