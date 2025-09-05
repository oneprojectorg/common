/**
 * UI package formatting utilities
 * Keep these lightweight and framework-agnostic
 */

/**
 * Parse YYYY-MM-DD format as local date to avoid timezone issues
 * @param dateString - Date string in YYYY-MM-DD format
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @param locale - Locale for formatting (default: 'en-US')
 * @returns Formatted date string
 */
export function formatDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
  locale: string = 'en-US'
): string {
  // Parse YYYY-MM-DD format as local date to avoid timezone issues (NOT UTC).
  const parts = dateString.split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => isNaN(part))) {
    // Fallback to original parsing if format is unexpected
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, options);
  }

  const [year, month, day] = parts as [number, number, number];
  const date = new Date(year, month - 1, day); // month is 0-indexed
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
