/**
 * UI package formatting utilities
 * Keep these lightweight and framework-agnostic
 */

/**
 * Format a date string for display.
 *
 * Renders in UTC by default, matching the app-wide next-intl `timeZone`. A
 * timestamp must format identically on the server and in the browser: without
 * a pinned zone the server (UTC) and a viewer west of the stored offset
 * disagree by a day — e.g. `2026-07-06T04:00:00Z` is "Jul 6" in UTC and
 * "Jul 5" in America/Los_Angeles — which fails hydration (React #418). Pass an
 * explicit `timeZone` in `options` only for values that are genuinely local to
 * the viewer and rendered after mount.
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
    return `${formatDate(startDate, { month: 'short', day: 'numeric' }, locale)} - ${formatDate(endDate, { month: 'short', day: 'numeric' }, locale)}`;
  }
  if (startDate) {
    return formatDate(startDate, { month: 'short', day: 'numeric' }, locale);
  }
  if (endDate) {
    return formatDate(endDate, { month: 'short', day: 'numeric' }, locale);
  }
  return '';
}
