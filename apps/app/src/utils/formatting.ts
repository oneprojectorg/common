/**
 * Shared formatting utilities for consistent display across the application
 */

/**
 * Format currency amount using locale-aware formatting
 */
export function formatCurrency(
  amount: number, 
  locale: string = 'en-US', 
  currency: string = 'USD'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
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
  }
): string {
  if (!dateString) {
    return formatDate(new Date().toISOString(), locale, options);
  }
  
  return new Date(dateString).toLocaleDateString(locale, options);
}

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