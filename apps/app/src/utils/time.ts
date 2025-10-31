'use client';

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import updateLocale from 'dayjs/plugin/updateLocale';

// Initialize plugins
dayjs.extend(relativeTime);
dayjs.extend(updateLocale);

// Internal dayjs instance - not exported
let currentLocale = 'en';

/**
 * Sets the locale for relative time formatting
 * @param locale - The locale code (e.g., 'en', 'es', 'fr')
 */
export const setLocale = (locale: string): void => {
  currentLocale = locale;
  dayjs.locale(locale);
};

/**
 * Formats a timestamp as relative time (e.g., "5 minutes", "2 hours")
 * @param timestamp - Date, string, or number representing the timestamp
 * @returns Formatted relative time string without suffix
 */
export const formatRelativeTime = (
  timestamp: Date | string | number,
): string => {
  const date = dayjs(timestamp);

  // Ensure locale is set
  if (currentLocale) {
    date.locale(currentLocale);
  }

  return date.fromNow(true);
};
