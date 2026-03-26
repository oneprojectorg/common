/**
 * UI package formatting utilities
 * Keep these lightweight and framework-agnostic
 */

/**
 * Format a date string for display in the user's local timezone.
 */
export function formatDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
  locale: string = 'en-US',
): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, options);
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
