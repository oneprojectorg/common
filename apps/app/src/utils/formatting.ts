/**
 * Shared formatting utilities for consistent display across the application
 */
import {
  formatDate as formatDateCore,
  formatDateRange as formatDateRangeCore,
} from '@op/ui/utils/formatting';

/**
 * Format currency amount using locale-aware formatting
 */
export function formatCurrency(
  amount: number,
  locale: string = 'en-US',
  currency: string = 'USD',
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
