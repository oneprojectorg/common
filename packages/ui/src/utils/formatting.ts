/**
 * UI package formatting utilities
 * Keep these lightweight and framework-agnostic
 */

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

  const formatSingleDate = (dateString: string) => {
    // Parse YYYY-MM-DD format as local date to avoid timezone issues (NOT UTC).
    // TODO: This might need to be configurable to allow for cross-time-zone stable deadlines
    const parts = dateString.split('-').map(Number);
    if (parts.length !== 3 || parts.some((part) => isNaN(part))) {
      // Fallback to original parsing if format is unexpected
      const date = new Date(dateString);
      return date.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
      });
    }

    const [year, month, day] = parts as [number, number, number];
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    });
  };

  if (startDate && endDate) {
    return `${formatSingleDate(startDate)} - ${formatSingleDate(endDate)}`;
  }
  if (startDate) {
    return formatSingleDate(startDate);
  }
  if (endDate) {
    return formatSingleDate(endDate);
  }
  return '';
}
