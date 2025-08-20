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
  locale: string = 'en-US'
): string {
  if (!startDate && !endDate) return '';

  const formatSingleDate = (dateStr: string) => {
    const date = new Date(dateStr);
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