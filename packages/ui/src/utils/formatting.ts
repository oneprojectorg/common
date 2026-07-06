/**
 * UI package formatting utilities
 * Keep these lightweight and framework-agnostic
 */

/**
 * Format a date string for display. Rendered in UTC so server-rendered HTML
 * matches the client during hydration — a viewer-local timezone would shift
 * the displayed day near midnight and mismatch the SSR output (React #418).
 */
export function formatDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
  locale: string = 'en-US',
): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, { timeZone: 'UTC', ...options });
}

/**
 * Format a process phase date for display.
 *
 * Phase dates are stored as the author's local midnight serialized to ISO
 * (see ProcessBuilder's `formatDateValue`), so the instant's UTC calendar day
 * can be one day earlier than the day the author picked. Shifting to the
 * middle of the stored day before formatting in UTC recovers the intended
 * day for any author timezone within UTC±12, while staying deterministic
 * across SSR and hydration (React #418).
 */
const HALF_DAY_MS = 12 * 60 * 60 * 1000;

export function formatPhaseDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
  locale: string = 'en-US',
): string {
  const shifted = new Date(new Date(dateString).getTime() + HALF_DAY_MS);
  return shifted.toLocaleDateString(locale, { timeZone: 'UTC', ...options });
}

/**
 * Format date range for phases and events
 */
export function formatDateRange(
  startDate?: string,
  endDate?: string,
  locale: string = 'en-US',
): string {
  if (!startDate && !endDate) {
    return '';
  }

  if (startDate && endDate) {
    return `${formatPhaseDate(startDate, { month: 'short', day: 'numeric' }, locale)} - ${formatPhaseDate(endDate, { month: 'short', day: 'numeric' }, locale)}`;
  }
  if (startDate) {
    return formatPhaseDate(
      startDate,
      { month: 'short', day: 'numeric' },
      locale,
    );
  }
  if (endDate) {
    return formatPhaseDate(endDate, { month: 'short', day: 'numeric' }, locale);
  }
  return '';
}
