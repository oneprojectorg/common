/**
 * Shared formatting utilities for consistent display across the application.
 *
 * Every helper here names its locale and time zone rather than letting `Intl`
 * fall back to the runtime default. The default is the server's during SSR and
 * the browser's on the client, so an implicit one makes the two renders
 * disagree and hydration fails (React #418).
 */
import { APP_TIME_ZONE } from '@/lib/i18n/config';

/**
 * Format a plain number using locale-aware grouping.
 */
export function formatNumber(value: number, locale: string = 'en-US'): string {
  return new Intl.NumberFormat(locale).format(value);
}

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
 * Format single date using locale-aware formatting.
 *
 * Renders in `APP_TIME_ZONE` unless `options` names another one. Pass an
 * explicit `timeZone` only for a value that is genuinely local to the viewer
 * and rendered after mount.
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

  return new Date(dateString).toLocaleDateString(locale, {
    timeZone: APP_TIME_ZONE,
    ...options,
  });
}

/**
 * Format a moment the viewer has to act before — a phase close, a results
 * announcement.
 *
 * Always carries the time and the zone, because a phase end is enforced at an
 * exact instant: `buildExpectedTransitions` schedules the transition at the
 * stored `endDate` and the cron in `transitionMonitor` fires it the moment it
 * comes due. Rendering only the calendar day tells a viewer west of the zone
 * the date was picked in that they have until the end of a day that is already
 * over for the process.
 *
 * Pass `timeZone` from `useDisplayTimeZone()` so the string is the viewer's
 * own wall-clock time once mounted.
 */
export const DEADLINE_FORMAT = {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
} as const;

export function formatDeadline(
  dateString: string,
  locale: string = 'en-US',
  timeZone: string = APP_TIME_ZONE,
): string {
  return new Date(dateString).toLocaleString(locale, {
    ...DEADLINE_FORMAT,
    timeZone,
  });
}

/**
 * Format date range for phases and events
 */
export function formatDateRange(
  startDate?: string,
  endDate?: string,
  locale: string = 'en-US',
): string {
  const short: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (startDate && endDate) {
    return `${formatDate(startDate, locale, short)} - ${formatDate(endDate, locale, short)}`;
  }
  if (startDate) {
    return formatDate(startDate, locale, short);
  }
  if (endDate) {
    return formatDate(endDate, locale, short);
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

/**
 * Format a byte count as a human-readable file size (e.g. `4.8 MB`).
 *
 * Lives here rather than in a design-system package so app surfaces don't have
 * to pull in the design system just for a number formatter.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1,
  );
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Date-time format options for a full timestamp, with no zone of its own.
 *
 * Used with next-intl's `useFormatter().dateTime()`. Pair it with
 * `useDisplayTimeZone()` at the call site so the timestamp renders in the
 * viewer's zone after mount without breaking hydration.
 */
export const DATE_TIME_FORMAT = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
} as const;
